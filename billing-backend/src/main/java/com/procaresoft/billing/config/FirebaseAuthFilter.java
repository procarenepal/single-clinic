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
 * token is missing/invalid, every request is rejected with 401.
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

        try {
            // checkRevoked=true costs an extra Firebase Auth lookup per
            // request, but without it a deactivated/revoked user's
            // still-unexpired token (issued up to 1hr ago) keeps working
            // against this billing/IRD-sync API even after an admin
            // deactivates them — deactivation today is only enforced
            // client-side (ProtectedRoute), not by token verification.
            FirebaseToken decodedToken = FirebaseAuth.getInstance().verifyIdToken(token, true);
            request.setAttribute("userUid", decodedToken.getUid());
            request.setAttribute("clinicId", resolveClinicId(decodedToken.getUid()));

            filterChain.doFilter(request, response);
        } catch (Exception e) {
            log.warn("Rejecting request to {}: {}", request.getRequestURI(), e.getMessage());
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.getWriter().write("Invalid or expired token");
        }
    }

    private String resolveClinicId(String uid) {
        try {
            Firestore firestore = FirestoreClient.getFirestore();
            DocumentSnapshot userDoc = firestore.collection("users").document(uid).get().get();
            if (!userDoc.exists()) {
                return null;
            }
            return userDoc.getString("clinicId");
        } catch (Exception e) {
            log.warn("Failed to resolve clinicId for uid {}: {}", uid, e.getMessage());
            return null;
        }
    }
}
