package com.procaresoft.billing.config;

import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.firebase.FirebaseApp;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseToken;
import com.google.firebase.cloud.FirestoreClient;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Verifies a Firebase ID token on every request and resolves the caller's
 * clinicId server-side from their Firestore `users/{uid}` document — clinicId
 * is never trusted from client-supplied request bodies or params.
 *
 * Fails closed: if Firebase Admin isn't initialized (see FirebaseConfig) or the
 * token is missing/invalid, every request is rejected with 401. A token that
 * verifies but whose clinic lookup fails gets 503, not 401 or 403 — the caller
 * is authenticated and the request is worth retrying.
 */
@Component
public class FirebaseAuthFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(FirebaseAuthFilter.class);

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        if (FirebaseApp.getApps().isEmpty()) {
            log.error("Rejecting request to {} — Firebase Admin SDK is not initialized", request.getRequestURI());
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.getWriter().write("Authentication is not configured on this server");
            return;
        }

        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.getWriter().write("Missing or invalid Authorization header");
            return;
        }

        String token = authHeader.substring(7);

        FirebaseToken decodedToken;

        try {
            // checkRevoked=true costs an extra Firebase Auth lookup per
            // request, but without it a deactivated/revoked user's
            // still-unexpired token (issued up to 1hr ago) keeps working
            // against this billing/IRD-sync API even after an admin
            // deactivates them — deactivation today is only enforced
            // client-side (ProtectedRoute), not by token verification.
            decodedToken = FirebaseAuth.getInstance().verifyIdToken(token, true);
        } catch (Exception e) {
            log.warn("Rejecting request to {}: {}", request.getRequestURI(), e.getMessage());
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.getWriter().write("Invalid or expired token");

            return;
        }

        String clinicId;

        try {
            clinicId = resolveClinicId(decodedToken.getUid());
        } catch (Exception e) {
            // The caller IS authenticated; we just could not read which clinic
            // they belong to. This used to be swallowed into a null clinicId,
            // which every controller then reported as 403 "No clinic is
            // associated with the authenticated user" — an authorization
            // verdict for what is actually a transient infrastructure fault.
            // Observed live: a long-lived Firestore channel in this process
            // went bad and every invoice creation failed with that 403 until
            // the backend was restarted, while the message sent staff looking
            // for a misconfigured user account. 503 says "retry", which is the
            // truth, and the cause is now logged instead of discarded.
            log.error("Could not read the clinic of authenticated uid {} — failing this request as retryable",
                    decodedToken.getUid(), e);
            response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
            response.getWriter().write("Could not determine your clinic right now — please retry");

            return;
        }

        request.setAttribute("userUid", decodedToken.getUid());
        request.setAttribute("clinicId", clinicId);

        // Deliberately outside the try/catch above: a failure raised further
        // down the chain is not an authentication problem, and reporting it as
        // "Invalid or expired token" would send anyone debugging it in exactly
        // the wrong direction.
        filterChain.doFilter(request, response);
    }

    /**
     * The caller's clinic, read from their own Firestore user document.
     *
     * Returns null only when the answer is genuinely "this user has no
     * clinic" — the document is missing, or present without a clinicId. A
     * failure to *read* it is rethrown rather than flattened into null, so the
     * two cases can be answered differently: one is a 403, the other a 503.
     */
    private String resolveClinicId(String uid) {
        Firestore firestore = FirestoreClient.getFirestore();
        DocumentSnapshot userDoc;

        try {
            userDoc = firestore.collection("users").document(uid).get().get();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();

            throw new IllegalStateException("Interrupted reading users/" + uid, e);
        } catch (Exception e) {
            throw new IllegalStateException("Could not read users/" + uid, e);
        }

        if (!userDoc.exists()) {
            return null;
        }

        return userDoc.getString("clinicId");
    }
}
