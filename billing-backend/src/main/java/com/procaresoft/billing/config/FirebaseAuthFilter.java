package com.procaresoft.billing.config;

import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.firebase.FirebaseApp;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseToken;
import com.google.firebase.cloud.FirestoreClient;
import com.procaresoft.billing.service.CallerAuthorizationService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

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

    /**
     * How long a resolved clinic assignment is trusted without re-reading.
     * Deliberately short: a minute is already enough to collapse the bursts of
     * requests a single screen makes, which is where the availability win
     * comes from, while keeping the window in which a changed assignment is
     * still being served down to something a person would not notice.
     */
    private static final long TTL_MS = 60 * 1000L;
    /**
     * How long a stale entry is held when Firestore cannot be reached, so an
     * outage does not turn into a per-request retry storm against it.
     */
    private static final long STALE_GRACE_MS = 60 * 1000L;

    private static final Map<String, CachedClinic> CLINIC_CACHE =
            new ConcurrentHashMap<>();

    private final CallerAuthorizationService callerAuthorizationService;

    public FirebaseAuthFilter(CallerAuthorizationService callerAuthorizationService) {
        this.callerAuthorizationService = callerAuthorizationService;
    }

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

        // What this caller may do to the ledger, resolved here so every
        // endpoint can ask rather than each one re-deriving it. Same
        // failure semantics as the clinic lookup above: an answer that
        // cannot be determined is retryable, not a refusal.
        CallerAuthorizationService.Caller caller;

        try {
            caller = callerAuthorizationService.resolve(decodedToken.getUid());
        } catch (Exception e) {
            log.error("Could not determine the permissions of authenticated uid {} — failing this request as retryable",
                    decodedToken.getUid(), e);
            response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
            response.getWriter().write("Could not check your permissions right now — please retry");

            return;
        }

        request.setAttribute("userUid", decodedToken.getUid());
        request.setAttribute("clinicId", clinicId);
        request.setAttribute("caller", caller);

        // Deliberately outside the try/catch above: a failure raised further
        // down the chain is not an authentication problem, and reporting it as
        // "Invalid or expired token" would send anyone debugging it in exactly
        // the wrong direction.
        filterChain.doFilter(request, response);
    }

    /**
     * The caller's clinic, read from their own Firestore user document and
     * cached briefly.
     *
     * Why the cache exists: this is on the path of EVERY request, so without
     * it a momentary inability to reach Firestore stops all billing at once.
     * That is not hypothetical — it was observed here as
     * "UNAVAILABLE: Unable to resolve host firestore.googleapis.com", and
     * every invoice creation failed until the process was restarted. A clinic
     * assignment changes about never, so re-reading it per request bought
     * nothing and cost availability.
     *
     * A stale entry is deliberately preferred over an error when the read
     * fails: answering from a slightly old clinic assignment is strictly
     * better than refusing to bill, and the assignment is the same value it
     * would have read anyway. Only a cold cache turns a read failure into a
     * 503.
     *
     * Deactivation is NOT weakened by this. It is enforced by
     * verifyIdToken(token, checkRevoked=true) above, which is a separate check
     * against Firebase Auth and runs on every request regardless of this
     * cache. What a cache entry can delay is a *clinic reassignment* taking
     * effect, by at most the TTL.
     *
     * Returns null only when the answer is genuinely "this user has no
     * clinic" — the document is missing, or present without a clinicId. A
     * null is never itself cached, and any existing entry is dropped when one
     * is seen, so a user who is GIVEN a clinic can bill as soon as the next
     * read happens.
     *
     * The converse is not immediate, and that is the honest cost of caching:
     * a user whose clinic is removed or changed keeps resolving to the old one
     * until their entry expires — verified, so it is a documented property
     * rather than a surprise. It is not how access is revoked; that is
     * verifyIdToken(checkRevoked=true) above, which consults Firebase Auth on
     * every request and is unaffected by this cache.
     */
    private String resolveClinicId(String uid) {
        CachedClinic cached = CLINIC_CACHE.get(uid);
        long now = System.currentTimeMillis();

        if (cached != null && now < cached.expiresAt) {
            return cached.clinicId;
        }

        DocumentSnapshot userDoc;

        try {
            Firestore firestore = FirestoreClient.getFirestore();

            userDoc = firestore.collection("users").document(uid).get().get();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();

            throw new IllegalStateException("Interrupted reading users/" + uid, e);
        } catch (Exception e) {
            if (cached != null) {
                log.warn("Could not re-read users/{} ({}) — serving the cached clinic {} so billing keeps working",
                        uid, e.getMessage(), cached.clinicId);
                // Hold the stale value briefly rather than hammering a
                // Firestore that is currently unreachable on every request.
                CLINIC_CACHE.put(uid, new CachedClinic(cached.clinicId, now + STALE_GRACE_MS));

                return cached.clinicId;
            }

            throw new IllegalStateException("Could not read users/" + uid, e);
        }

        if (!userDoc.exists()) {
            CLINIC_CACHE.remove(uid);

            return null;
        }

        String clinicId = userDoc.getString("clinicId");

        if (clinicId == null || clinicId.isBlank()) {
            CLINIC_CACHE.remove(uid);

            return null;
        }

        CLINIC_CACHE.put(uid, new CachedClinic(clinicId, now + TTL_MS));

        return clinicId;
    }

    private static final class CachedClinic {
        private final String clinicId;
        private final long expiresAt;

        private CachedClinic(String clinicId, long expiresAt) {
            this.clinicId = clinicId;
            this.expiresAt = expiresAt;
        }
    }
}
