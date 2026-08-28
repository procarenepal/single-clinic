package com.procaresoft.billing.controller;

import com.procaresoft.billing.dto.ClinicIrdConfigRequestDto;
import com.procaresoft.billing.dto.ClinicIrdConfigResponseDto;
import com.procaresoft.billing.service.ClinicIrdConfigService;
import com.procaresoft.billing.service.AuditLogService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * Manages a clinic's IRD credentials server-side. The frontend should stop
 * storing irdApiUsername/irdApiPassword in Firestore and use this instead —
 * the password is write-only and is never echoed back in any response.
 */
@RestController
@RequestMapping("/api/billing/clinic-config")
@RequiredArgsConstructor
public class ClinicIrdConfigController {

    private final ClinicIrdConfigService clinicIrdConfigService;
    private final AuditLogService auditLogService;

    private String requireClinicId(HttpServletRequest httpRequest) {
        String clinicId = (String) httpRequest.getAttribute("clinicId");
        if (clinicId == null || clinicId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "No clinic is associated with the authenticated user");
        }
        return clinicId;
    }

    @GetMapping
    public ResponseEntity<ClinicIrdConfigResponseDto> getConfig(HttpServletRequest httpRequest) {
        return ResponseEntity.ok(clinicIrdConfigService.getConfigView(requireClinicId(httpRequest)));
    }

    @PutMapping
    public ResponseEntity<ClinicIrdConfigResponseDto> upsertConfig(
            @Valid @RequestBody ClinicIrdConfigRequestDto request, HttpServletRequest httpRequest) {
        String clinicId = requireClinicId(httpRequest);
        ClinicIrdConfigResponseDto result = clinicIrdConfigService.upsert(clinicId, request);

        // Never log credential values — only that a config change happened.
        auditLogService.record("ClinicIrdConfig", clinicId, "UPDATE",
                (String) httpRequest.getAttribute("userUid"), clinicId,
                "IRD config updated (environment: " + result.getIrdEnvironment() + ", enabled: " + result.isEnabled() + ")");

        return ResponseEntity.ok(result);
    }
}
