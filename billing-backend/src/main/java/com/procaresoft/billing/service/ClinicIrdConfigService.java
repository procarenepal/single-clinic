package com.procaresoft.billing.service;

import com.procaresoft.billing.dto.ClinicIrdConfigRequestDto;
import com.procaresoft.billing.dto.ClinicIrdConfigResponseDto;
import com.procaresoft.billing.model.ClinicIrdConfig;
import com.procaresoft.billing.repository.ClinicIrdConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * Resolves and stores per-clinic IRD credentials server-side. This is the only
 * place IRD credentials should be read from — never trust irdApiUsername/
 * irdApiPassword coming from a client request body.
 */
@Service
@RequiredArgsConstructor
public class ClinicIrdConfigService {

    private final ClinicIrdConfigRepository repository;

    public Optional<ClinicIrdConfig> resolveForClinic(String clinicId) {
        return repository.findByClinicId(clinicId);
    }

    public ClinicIrdConfigResponseDto getConfigView(String clinicId) {
        return repository.findByClinicId(clinicId)
                .map(c -> new ClinicIrdConfigResponseDto(
                        c.getSellerPan(),
                        c.getIrdEnvironment(),
                        c.getIrdApiUrl(),
                        c.getIrdApiUsername(),
                        c.getIrdApiPassword() != null && !c.getIrdApiPassword().isBlank(),
                        c.isEnabled()))
                .orElseGet(() -> new ClinicIrdConfigResponseDto(null, "mock", null, null, false, false));
    }

    @Transactional
    public ClinicIrdConfigResponseDto upsert(String clinicId, ClinicIrdConfigRequestDto request) {
        ClinicIrdConfig config = repository.findByClinicId(clinicId).orElseGet(() -> {
            ClinicIrdConfig fresh = new ClinicIrdConfig();
            fresh.setClinicId(clinicId);
            return fresh;
        });

        config.setSellerPan(request.getSellerPan());
        config.setIrdEnvironment(request.getIrdEnvironment() != null ? request.getIrdEnvironment() : "mock");
        config.setIrdApiUrl(request.getIrdApiUrl());
        config.setIrdApiUsername(request.getIrdApiUsername());
        config.setEnabled(request.isEnabled());

        // Password is write-only: only overwrite when a non-blank value was actually sent.
        if (request.getIrdApiPassword() != null && !request.getIrdApiPassword().isBlank()) {
            config.setIrdApiPassword(request.getIrdApiPassword());
        }

        repository.save(config);
        return getConfigView(clinicId);
    }
}
