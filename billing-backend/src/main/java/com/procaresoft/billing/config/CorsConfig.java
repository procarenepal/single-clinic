package com.procaresoft.billing.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * CORS origins are configurable via CORS_ALLOWED_ORIGINS (comma-separated),
 * defaulting to local dev only — replacing the previous hardcoded
 * @CrossOrigin(origins = "http://localhost:5173") on BillingController, which
 * had no way to allow a real deployed frontend origin without a code change.
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Value("${cors.allowed-origins:http://localhost:5173,http://127.0.0.1:5173}")
    private String allowedOrigins;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        // No DELETE: nothing in this API deletes a record — invoices and their
        // audit log (IrdSyncLog) are insert/update-only by design (IRD requires
        // no hard deletes on billing records), so DELETE isn't offered at all.
        registry.addMapping("/api/**")
                .allowedOrigins(allowedOrigins.split(","))
                .allowedMethods("GET", "POST", "PUT", "OPTIONS")
                .allowedHeaders("*");
    }
}
