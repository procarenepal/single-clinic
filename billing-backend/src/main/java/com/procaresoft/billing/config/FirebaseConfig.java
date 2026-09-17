package com.procaresoft.billing.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import javax.annotation.PostConstruct;
import java.io.ByteArrayInputStream;
import java.io.FileInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * Initializes the Firebase Admin SDK from an externally-supplied service account
 * credential — never from a file committed to the repo. Supply either:
 *  - FIREBASE_SERVICE_ACCOUNT_JSON: the full service-account JSON content, or
 *  - FIREBASE_SERVICE_ACCOUNT_PATH: a filesystem path to the JSON key file.
 *
 * If neither is configured, Firebase Admin is left uninitialized. FirebaseAuthFilter
 * fails closed in that case (every request is rejected with 401) rather than allowing
 * unauthenticated access — broken-but-secure beats working-but-open for a billing API.
 */
@Configuration
public class FirebaseConfig {

    private static final Logger log = LoggerFactory.getLogger(FirebaseConfig.class);

    @Value("${firebase.service-account.json:}")
    private String serviceAccountJson;

    @Value("${firebase.service-account.path:}")
    private String serviceAccountPath;

    @Value("${firebase.storage-bucket:}")
    private String storageBucket;

    @PostConstruct
    public void init() {
        if (!FirebaseApp.getApps().isEmpty()) {
            return;
        }
        try (InputStream credentialStream = resolveCredentialStream()) {
            if (credentialStream == null) {
                log.error("Firebase Admin SDK NOT initialized: no FIREBASE_SERVICE_ACCOUNT_JSON or "
                        + "FIREBASE_SERVICE_ACCOUNT_PATH configured. All authenticated endpoints will "
                        + "reject requests with 401 until this is set.");
                return;
            }
            FirebaseOptions.Builder optionsBuilder = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(credentialStream));
            if (storageBucket != null && !storageBucket.isBlank()) {
                optionsBuilder.setStorageBucket(storageBucket);
            }
            FirebaseApp.initializeApp(optionsBuilder.build());
            log.info("Firebase Admin SDK initialized successfully.");
        } catch (Exception e) {
            log.error("Firebase Admin SDK initialization failed. All authenticated endpoints will reject "
                    + "requests with 401 until this is fixed.", e);
        }
    }

    private InputStream resolveCredentialStream() throws Exception {
        if (serviceAccountJson != null && !serviceAccountJson.isBlank()) {
            return new ByteArrayInputStream(serviceAccountJson.getBytes(StandardCharsets.UTF_8));
        }
        if (serviceAccountPath != null && !serviceAccountPath.isBlank()) {
            return new FileInputStream(serviceAccountPath);
        }
        return null;
    }
}
