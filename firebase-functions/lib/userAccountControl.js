"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setUserAccountDisabled = void 0;
const https_1 = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
/**
 * Deactivating a staff/doctor/expert login (userService.deactivateUser,
 * called from Staff & User Management) used to only ever flip a Firestore
 * `isActive` flag. The person's actual Firebase Auth account — and any ID
 * token it had already issued — stayed fully valid: the client only
 * re-checks `isActive` inside onAuthStateChanged, which fires at sign-in but
 * doesn't re-fire on its own, so an already-open browser tab kept full
 * read/write access indefinitely after an admin believed the account was
 * cut off.
 *
 * This is the actual server-side enforcement point. It:
 *   1. Disables the Firebase Auth account (`disabled: true`), which blocks
 *      every future sign-in attempt and every future token refresh.
 *   2. On disable, also revokes the account's refresh tokens, so the
 *      *current* token cannot be renewed once it naturally expires.
 *
 * What this does NOT do: invalidate an ID token that was already issued and
 * hasn't expired yet. Firebase ID tokens are self-contained JWTs that
 * Firestore validates by signature/expiry, not by a live revocation check
 * on every request — so a tab with a live token keeps working for the rest
 * of that token's lifetime (at most ~1 hour) even after this function runs.
 * Closing that residual window would require a custom backend
 * re-validating every request with `checkRevoked: true`, which this
 * Firestore-rules-based app does not have. This function closes the
 * "deactivated but can still sign back in / stay signed in indefinitely"
 * gap, which is the one that actually matters for an admin revoking access
 * to a departing or compromised account.
 */
exports.setUserAccountDisabled = (0, https_1.onRequest)({ cors: true }, async (req, res) => {
    try {
        if (req.method !== "POST") {
            res.status(405).json({ success: false, message: "Method not allowed" });
            return;
        }
        const authHeader = req.headers.authorization || "";
        if (!authHeader.startsWith("Bearer ")) {
            res.status(401).json({
                success: false,
                message: "Missing or invalid Authorization header",
            });
            return;
        }
        let callerUid;
        try {
            const decoded = await admin.auth().verifyIdToken(authHeader.substring(7));
            callerUid = decoded.uid;
        }
        catch (_a) {
            res.status(401).json({ success: false, message: "Invalid or expired token" });
            return;
        }
        const { userId, disabled } = req.body || {};
        if (!userId ||
            typeof userId !== "string" ||
            typeof disabled !== "boolean") {
            res.status(400).json({
                success: false,
                message: "Missing or invalid userId/disabled",
            });
            return;
        }
        if (userId === callerUid) {
            // An admin disabling their own account through this path could lock
            // themselves out with nobody left able to reverse it.
            res.status(400).json({
                success: false,
                message: "You cannot change your own account's status",
            });
            return;
        }
        const db = admin.firestore();
        const [callerSnap, targetSnap] = await Promise.all([
            db.collection("users").doc(callerUid).get(),
            db.collection("users").doc(userId).get(),
        ]);
        if (!callerSnap.exists) {
            res.status(403).json({ success: false, message: "Caller has no user record" });
            return;
        }
        if (!targetSnap.exists) {
            res.status(404).json({ success: false, message: "Target user not found" });
            return;
        }
        const callerData = callerSnap.data();
        const targetData = targetSnap.data();
        const callerIsAdmin = callerData.role === "clinic-admin" ||
            callerData.role === "clinic-super-admin" ||
            callerData.role === "super-admin";
        if (!callerIsAdmin || callerData.clinicId !== targetData.clinicId) {
            res.status(403).json({
                success: false,
                message: "Not authorised to change this account's status",
            });
            return;
        }
        await admin.auth().updateUser(userId, { disabled });
        if (disabled) {
            await admin.auth().revokeRefreshTokens(userId);
        }
        logger.info("setUserAccountDisabled: updated", {
            userId,
            disabled,
            callerUid,
        });
        res.json({ success: true });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("setUserAccountDisabled: failed", { message });
        res.status(500).json({ success: false, message });
    }
});
//# sourceMappingURL=userAccountControl.js.map