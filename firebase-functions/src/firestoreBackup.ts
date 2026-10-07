import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineString } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

/**
 * Nightly Firestore export, for IRD's Electronic Invoice Procedure §6(ग)
 * and §8(घ): the database and its logs must be backed up and recoverable,
 * retained for the statutory period.
 *
 * The MySQL ledger has had a nightly mysqldump since the compliance work
 * in September (DatabaseBackupService, 02:00 Kathmandu). Firestore — which
 * holds every invoice document, every payment event, every wallet
 * transaction — had nothing scheduled at all. Half the database was
 * backed up; the half every screen reads from was not.
 *
 * Runs at 02:30 Kathmandu, after the MySQL dump, so the two snapshots of
 * the same day sit within half an hour of each other and reconcile.
 *
 * Deploy requirements (one-time, outside this code):
 *   - The functions service account needs roles/datastore.importExportAdmin
 *     on the project and roles/storage.objectAdmin on the target bucket.
 *   - Set FIRESTORE_BACKUP_BUCKET if the default bucket is not wanted:
 *       firebase functions:config is NOT used — this is a v2 param, set at
 *       deploy time or in .env.<project>.
 *   - Firestore export is billed per document read; at this clinic's
 *     volume (hundreds of documents) that is negligible.
 *
 * Restore is `gcloud firestore import gs://<bucket>/firestore-backups/<date>`,
 * which is the "recovery" half of §6(ग).
 */

const BACKUP_BUCKET = defineString("FIRESTORE_BACKUP_BUCKET", {
  // The project's own default storage bucket, provisioned 2026-08-29 on
  // the Blaze plan. Exists already; no new bucket decision needed to turn
  // this on. Override to a bucket with a retention policy for the
  // statutory period if the default bucket's lifecycle ever changes.
  default: "gs://skincare-hospital.firebasestorage.app",
  description:
    "GCS bucket (gs://...) that nightly Firestore exports are written to.",
});

const BACKUP_PREFIX = "firestore-backups";

/** Kathmandu calendar date for the folder name, regardless of where the function runs. */
function kathmanduDateStamp(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // en-CA gives YYYY-MM-DD
}

export const firestoreBackup = onSchedule(
  {
    schedule: "30 2 * * *",
    timeZone: "Asia/Kathmandu",
    // An export of a few hundred documents finishes in seconds; the
    // generous ceiling is so a transient Firestore slowdown doesn't turn
    // into a missed night.
    timeoutSeconds: 540,
    retryCount: 2,
  },
  async () => {
    const projectId =
      process.env.GCLOUD_PROJECT || admin.app().options.projectId;

    if (!projectId) {
      logger.error("firestoreBackup: no project id resolvable; aborting");
      return;
    }

    const dateStamp = kathmanduDateStamp(new Date());
    const bucket = BACKUP_BUCKET.value().replace(/\/+$/, "");
    const outputUriPrefix = `${bucket}/${BACKUP_PREFIX}/${dateStamp}`;
    const databaseName = `projects/${projectId}/databases/(default)`;

    const client = new admin.firestore.v1.FirestoreAdminClient();

    try {
      const [operation] = await client.exportDocuments({
        name: databaseName,
        outputUriPrefix,
        // Empty = every collection. Deliberate: §8(घ) is about the whole
        // database, and listing collections here would silently drop any
        // added later.
        collectionIds: [],
      });

      logger.info("firestoreBackup: export started", {
        operation: operation.name,
        outputUriPrefix,
      });

      // Leave an auditable trail inside the database itself — the
      // evidence §6(ग) asks for is "backups are taken", and a log entry
      // that lives with the data is harder to lose than a Cloud Logging
      // line with a 30-day default retention.
      await admin.firestore().collection("backupRuns").doc(dateStamp).set(
        {
          kind: "firestore-export",
          outputUriPrefix,
          operationName: operation.name ?? null,
          startedAt: admin.firestore.FieldValue.serverTimestamp(),
          status: "started",
        },
        { merge: true },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      logger.error("firestoreBackup: export failed", { outputUriPrefix, message });

      await admin
        .firestore()
        .collection("backupRuns")
        .doc(dateStamp)
        .set(
          {
            kind: "firestore-export",
            outputUriPrefix,
            failedAt: admin.firestore.FieldValue.serverTimestamp(),
            status: "failed",
            error: message,
          },
          { merge: true },
        )
        .catch(() => {
          /* the failure is already in Cloud Logging; don't mask it with a second one */
        });

      // Rethrow so the scheduler's retryCount applies.
      throw error;
    }
  },
);
