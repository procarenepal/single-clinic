package com.procaresoft.billing.service;

import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.google.firebase.cloud.FirestoreClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * What the caller is allowed to do to the ledger.
 *
 * Why this exists: until now the only question asked of a request was "are you
 * authenticated and do you belong to a clinic". Every role-based restriction in
 * this product lived in the browser and in firestore.rules, and this API
 * bypasses both — so any signed-in user could create invoices, reserve numbers
 * from the IRD sequence, cancel invoices or rewrite IRD sync state by calling
 * it directly. The authoritative tax ledger had the weakest authorization in
 * the system.
 *
 * The answer deliberately MIRRORS what the UI enforces rather than inventing a
 * parallel scheme: a caller may write to the ledger if they hold a page
 * permission for one of the screens that raises invoices. Anything else would
 * drift from what administrators actually configure in Role Management, and a
 * rule nobody can see in the UI is a rule nobody maintains.
 *
 * Caching follows the same reasoning as the clinic lookup in
 * FirebaseAuthFilter: this is on the path of every request, so a momentary
 * Firestore problem must not stop all billing. A cold cache plus a failed read
 * is the one case that refuses the request, and it refuses it as retryable
 * rather than as a permissions verdict.
 */
@Service
public class CallerAuthorizationService {

    private static final Logger log = LoggerFactory.getLogger(CallerAuthorizationService.class);

    private static final long TTL_MS = 60 * 1000L;
    private static final long STALE_GRACE_MS = 60 * 1000L;

    /**
     * Roles that are treated as clinic administrators, matching
     * firestore.rules' isSuperAdmin() so the two layers cannot disagree about
     * who an administrator is.
     */
    private static final Set<String> ADMIN_ROLES =
            Set.of("super-admin", "clinic-admin", "clinic-super-admin");

    /**
     * The screens from which an invoice can be raised. Holding a permission for
     * any of them is what "may write to the ledger" means.
     */
    private static final Set<String> BILLING_PAGE_PATHS = Set.of(
            "/dashboard/billing-counter",
            "/dashboard/billing",
            "/dashboard/appointments-billing",
            "/dashboard/pathology",
            "/dashboard/pharmacy");

    private static final Map<String, CachedCaller> CACHE = new ConcurrentHashMap<>();

    /** Page-id set for BILLING_PAGE_PATHS — static config, so cached longer. */
    private static volatile Set<String> billingPageIds;
    private static volatile long billingPageIdsExpiry;

    public record Caller(String uid, String role, boolean admin, boolean mayWriteLedger) {}

    /**
     * Resolve what this uid may do, from their user document and their role
     * assignments.
     *
     * @throws IllegalStateException when the answer genuinely cannot be
     *     determined — the caller is authenticated, so this is a 503 rather
     *     than a refusal.
     */
    public Caller resolve(String uid) {
        CachedCaller cached = CACHE.get(uid);
        long now = System.currentTimeMillis();

        if (cached != null && now < cached.expiresAt) {
            return cached.caller;
        }

        try {
            Caller resolved = read(uid);

            CACHE.put(uid, new CachedCaller(resolved, now + TTL_MS));

            return resolved;
        } catch (Exception e) {
            if (cached != null) {
                log.warn("Could not re-read authorization for {} ({}) — holding the cached answer", uid,
                        e.getMessage());
                CACHE.put(uid, new CachedCaller(cached.caller, now + STALE_GRACE_MS));

                return cached.caller;
            }

            throw new IllegalStateException("Could not determine what " + uid + " is allowed to do", e);
        }
    }

    private Caller read(String uid) throws Exception {
        Firestore firestore = FirestoreClient.getFirestore();

        DocumentSnapshot userDoc = firestore.collection("users").document(uid).get().get();
        String role = userDoc.exists() ? userDoc.getString("role") : null;
        boolean admin = role != null && ADMIN_ROLES.contains(role);

        if (admin) {
            // An administrator needs no page permission, exactly as in
            // firestore.rules where isSuperAdmin() short-circuits every check.
            return new Caller(uid, role, true, true);
        }

        String clinicId = userDoc.exists() ? userDoc.getString("clinicId") : null;

        if (clinicId == null || clinicId.isBlank()) {
            return new Caller(uid, role, false, false);
        }

        Set<String> permitted = permittedPageIds(firestore, uid, clinicId);
        Set<String> billingIds = billingPageIds(firestore);

        boolean mayWrite = permitted.stream().anyMatch(billingIds::contains);

        return new Caller(uid, role, false, mayWrite);
    }

    /** Page ids granted to this user through their role assignments. */
    private Set<String> permittedPageIds(Firestore firestore, String uid, String clinicId) throws Exception {
        List<QueryDocumentSnapshot> assignments = firestore.collection("user_role_assignments")
                .whereEqualTo("userId", uid)
                .whereEqualTo("clinicId", clinicId)
                .get()
                .get()
                .getDocuments();

        Set<String> pageIds = new HashSet<>();

        for (QueryDocumentSnapshot assignment : assignments) {
            String roleId = assignment.getString("roleId");

            if (roleId == null || roleId.isBlank()) {
                continue;
            }

            DocumentSnapshot roleDoc = firestore.collection("roles").document(roleId).get().get();

            if (!roleDoc.exists()) {
                continue;
            }

            Object permissions = roleDoc.get("permissions");

            if (permissions instanceof List<?> list) {
                for (Object pageId : list) {
                    if (pageId != null) {
                        pageIds.add(String.valueOf(pageId));
                    }
                }
            }
        }

        return pageIds;
    }

    /**
     * Ids of the billing pages. The pages collection is deployment-wide static
     * configuration, so it is resolved once and held rather than re-read per
     * caller.
     */
    private Set<String> billingPageIds(Firestore firestore) throws Exception {
        long now = System.currentTimeMillis();
        Set<String> snapshot = billingPageIds;

        if (snapshot != null && now < billingPageIdsExpiry) {
            return snapshot;
        }

        Set<String> ids = new HashSet<>();

        for (QueryDocumentSnapshot page : firestore.collection("pages").get().get().getDocuments()) {
            String path = page.getString("path");

            if (path != null && BILLING_PAGE_PATHS.contains(path)) {
                ids.add(page.getId());
            }
        }

        billingPageIds = ids;
        billingPageIdsExpiry = now + 10 * 60 * 1000L;

        return ids;
    }

    private static final class CachedCaller {
        private final Caller caller;
        private final long expiresAt;

        private CachedCaller(Caller caller, long expiresAt) {
            this.caller = caller;
            this.expiresAt = expiresAt;
        }
    }
}
