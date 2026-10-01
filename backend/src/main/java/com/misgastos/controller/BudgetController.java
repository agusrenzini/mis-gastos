package com.misgastos.controller;

import com.misgastos.dto.BudgetRequest;
import com.misgastos.dto.BudgetResponse;
import com.misgastos.security.AppUserPrincipal;
import com.misgastos.service.BudgetService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Clock;
import java.time.YearMonth;

/** Presupuesto mensual por categoría y resumen del mes del usuario con sesión iniciada. */
@RestController
@RequestMapping("/api/budget")
public class BudgetController {

    private final BudgetService service;
    private final Clock clock;

    public BudgetController(BudgetService service, Clock clock) {
        this.service = service;
        this.clock = clock;
    }

    /** Ejemplo: GET /api/budget?month=2026-10 */
    @GetMapping
    public BudgetResponse view(@AuthenticationPrincipal AppUserPrincipal user,
                               @RequestParam(required = false) YearMonth month) {
        return service.view(user.id(), month != null ? month : YearMonth.now(clock));
    }

    @PutMapping
    public BudgetResponse save(@AuthenticationPrincipal AppUserPrincipal user,
                               @RequestParam YearMonth month,
                               @Valid @RequestBody BudgetRequest request) {
        return service.save(user.id(), month, request);
    }
}
