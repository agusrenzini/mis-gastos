package com.misgastos.controller;

import com.misgastos.dto.ExpenseRequest;
import com.misgastos.dto.ExpenseResponse;
import com.misgastos.security.AppUserPrincipal;
import com.misgastos.service.ExpenseService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

/** Siempre opera sobre los gastos del usuario con sesión iniciada. */
@RestController
@RequestMapping("/api/expenses")
public class ExpenseController {

    private final ExpenseService service;

    public ExpenseController(ExpenseService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ExpenseResponse create(@AuthenticationPrincipal AppUserPrincipal user,
                                  @Valid @RequestBody ExpenseRequest request) {
        return service.create(user.id(), request);
    }

    /** Ejemplo: GET /api/expenses?from=2026-09-01&to=2026-09-30 */
    @GetMapping
    public List<ExpenseResponse> list(
            @AuthenticationPrincipal AppUserPrincipal user,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.list(user.id(), from, to);
    }

    @GetMapping("/{id}")
    public ExpenseResponse get(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable Long id) {
        return service.get(user.id(), id);
    }

    @PutMapping("/{id}")
    public ExpenseResponse update(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable Long id,
                                  @Valid @RequestBody ExpenseRequest request) {
        return service.update(user.id(), id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable Long id) {
        service.delete(user.id(), id);
    }
}
