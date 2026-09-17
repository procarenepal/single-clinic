package com.procaresoft.billing.service;

import com.google.cloud.storage.Blob;
import com.google.cloud.storage.Bucket;
import com.google.firebase.cloud.StorageClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.format.DateTimeFormatter;
import java.time.ZoneOffset;
import java.util.concurrent.TimeUnit;

/**
 * Scheduled MySQL backup — IRD's Electronic Invoice Procedure (दफा ६घ/७घ)
 * requires the biller to keep the invoice database and its logs backed up.
 * Shells out to mysqldump (host-agnostic — works wherever the container
 * that runs this backend is eventually deployed) and uploads the result to
 * Firebase Storage, reusing the Admin SDK credential already configured in
 * FirebaseConfig for Firestore/Auth — no separate credential to manage.
 *
 * A backup failure must never take down invoice creation, so every failure
 * path here logs and returns rather than throwing.
 */
@Service
public class DatabaseBackupService {

    private static final Logger log = LoggerFactory.getLogger(DatabaseBackupService.class);
    private static final DateTimeFormatter TIMESTAMP_FORMAT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd_HHmmss").withZone(ZoneOffset.UTC);

    @Value("${backup.enabled:true}")
    private boolean enabled;

    @Value("${db.host}")
    private String dbHost;

    @Value("${db.port}")
    private String dbPort;

    @Value("${db.name}")
    private String dbName;

    @Value("${spring.datasource.username}")
    private String dbUsername;

    @Value("${spring.datasource.password}")
    private String dbPassword;

    @Scheduled(cron = "${backup.cron:0 0 2 * * *}")
    public void runScheduledBackup() {
        if (!enabled) {
            log.info("Scheduled MySQL backup skipped (backup.enabled=false).");
            return;
        }
        backupNow();
    }

    /**
     * Runs one backup immediately. Public so it can be triggered manually
     * (e.g. from a test or an admin endpoint added later) without waiting
     * for the cron schedule.
     */
    public void backupNow() {
        String timestamp = TIMESTAMP_FORMAT.format(java.time.Instant.now());
        Path dumpFile;

        try {
            dumpFile = Files.createTempFile("procare_billing_backup_" + timestamp, ".sql");
        } catch (IOException e) {
            log.error("MySQL backup failed: could not create temp file.", e);
            return;
        }

        try {
            if (!runMysqldump(dumpFile)) {
                return;
            }
            uploadToStorage(dumpFile, timestamp);
        } finally {
            try {
                Files.deleteIfExists(dumpFile);
            } catch (IOException e) {
                log.warn("Could not delete temp backup file {}", dumpFile, e);
            }
        }
    }

    private boolean runMysqldump(Path dumpFile) {
        ProcessBuilder pb = new ProcessBuilder(
                "mysqldump",
                "--host=" + dbHost,
                "--port=" + dbPort,
                "--user=" + dbUsername,
                "--password=" + dbPassword,
                "--single-transaction",
                "--routines",
                "--triggers",
                dbName
        );
        pb.redirectOutput(dumpFile.toFile());
        pb.redirectErrorStream(false);

        try {
            Process process = pb.start();
            boolean finished = process.waitFor(10, TimeUnit.MINUTES);

            if (!finished) {
                process.destroyForcibly();
                log.error("MySQL backup failed: mysqldump timed out after 10 minutes.");
                return false;
            }
            if (process.exitValue() != 0) {
                log.error("MySQL backup failed: mysqldump exited with code {}.", process.exitValue());
                return false;
            }
            if (Files.size(dumpFile) == 0) {
                log.error("MySQL backup failed: mysqldump produced an empty file.");
                return false;
            }

            return true;
        } catch (IOException e) {
            log.error("MySQL backup failed: could not run mysqldump — is the mysql-client "
                    + "package installed in this environment?", e);

            return false;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("MySQL backup interrupted.", e);

            return false;
        }
    }

    private void uploadToStorage(Path dumpFile, String timestamp) {
        try {
            Bucket bucket = StorageClient.getInstance().bucket();
            String objectPath = "mysql-backups/procare_billing_" + timestamp + ".sql";

            try (InputStream in = Files.newInputStream(dumpFile)) {
                Blob blob = bucket.create(objectPath, in, "application/sql");

                log.info("MySQL backup uploaded successfully: {} ({} bytes).",
                        blob.getName(), blob.getSize());
            }
        } catch (Exception e) {
            log.error("MySQL backup dump succeeded but upload to Firebase Storage failed. "
                    + "The dump file will be deleted anyway — this backup cycle is lost.", e);
        }
    }
}
