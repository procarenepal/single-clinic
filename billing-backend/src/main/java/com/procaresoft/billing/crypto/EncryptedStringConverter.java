package com.procaresoft.billing.crypto;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * AES-256-GCM converter for encrypting sensitive columns (IRD credentials) at rest.
 * Key comes from IRD_CONFIG_ENC_KEY (base64-encoded 32-byte key) — never hardcoded.
 * Fails closed: throws rather than silently persisting plaintext if the key is missing/invalid.
 */
@Component
@Converter
public class EncryptedStringConverter implements AttributeConverter<String, String> {

    private static final Logger log = LoggerFactory.getLogger(EncryptedStringConverter.class);
    private static final String ALGO = "AES/GCM/NoPadding";
    private static final int GCM_IV_LENGTH = 12;
    private static final int GCM_TAG_LENGTH = 128;

    @Value("${ird.config.encryption-key:}")
    private String base64Key;

    private SecretKeySpec keySpec() {
        if (base64Key == null || base64Key.isBlank()) {
            throw new IllegalStateException(
                    "IRD_CONFIG_ENC_KEY is not configured. Refusing to read/write IRD credentials without an encryption key.");
        }
        byte[] keyBytes;
        try {
            keyBytes = Base64.getDecoder().decode(base64Key);
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("IRD_CONFIG_ENC_KEY is not valid base64.", e);
        }
        if (keyBytes.length != 32) {
            throw new IllegalStateException("IRD_CONFIG_ENC_KEY must decode to exactly 32 bytes (AES-256). Got: " + keyBytes.length);
        }
        return new SecretKeySpec(keyBytes, "AES");
    }

    @Override
    public String convertToDatabaseColumn(String plainText) {
        if (plainText == null) {
            return null;
        }
        try {
            byte[] iv = new byte[GCM_IV_LENGTH];
            new SecureRandom().nextBytes(iv);
            Cipher cipher = Cipher.getInstance(ALGO);
            cipher.init(Cipher.ENCRYPT_MODE, keySpec(), new GCMParameterSpec(GCM_TAG_LENGTH, iv));
            byte[] cipherText = cipher.doFinal(plainText.getBytes(java.nio.charset.StandardCharsets.UTF_8));

            byte[] combined = new byte[iv.length + cipherText.length];
            System.arraycopy(iv, 0, combined, 0, iv.length);
            System.arraycopy(cipherText, 0, combined, iv.length, cipherText.length);
            return Base64.getEncoder().encodeToString(combined);
        } catch (Exception e) {
            log.error("Failed to encrypt IRD credential column", e);
            throw new IllegalStateException("Encryption failure", e);
        }
    }

    @Override
    public String convertToEntityAttribute(String dbValue) {
        if (dbValue == null) {
            return null;
        }
        try {
            byte[] combined = Base64.getDecoder().decode(dbValue);
            byte[] iv = new byte[GCM_IV_LENGTH];
            byte[] cipherText = new byte[combined.length - GCM_IV_LENGTH];
            System.arraycopy(combined, 0, iv, 0, GCM_IV_LENGTH);
            System.arraycopy(combined, GCM_IV_LENGTH, cipherText, 0, cipherText.length);

            Cipher cipher = Cipher.getInstance(ALGO);
            cipher.init(Cipher.DECRYPT_MODE, keySpec(), new GCMParameterSpec(GCM_TAG_LENGTH, iv));
            byte[] plainText = cipher.doFinal(cipherText);
            return new String(plainText, java.nio.charset.StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.error("Failed to decrypt IRD credential column", e);
            throw new IllegalStateException("Decryption failure", e);
        }
    }
}
