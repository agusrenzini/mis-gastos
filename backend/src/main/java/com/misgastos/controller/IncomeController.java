package com.misgastos.controller;

import com.misgastos.dto.IncomeRequest;
import com.misgastos.dto.IncomeResponse;
import com.misgastos.dto.ReceiveIncomeRequest;
import com.misgastos.security.AppUserPrincipal;
import com.misgastos.service.IncomeService;
import jakarta.validation.Valid;
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

import java.time.Clock;
import java.time.YearMonth;
import java.util.List;

/** Ingresos del usuario con sesión iniciada. */
@RestController
@RequestMapping("/api/incomes")
public class IncomeController {

    private final IncomeService service;
    private final Clock clock;

    public IncomeController(IncomeService service, Clock clock) {
        this.service = service;
        this.clock = clock;
    }

    /** Ejemplo: GET /api/incomes?month=2026-10 (sin month usa el mes actual). */
    @GetMapping
    public List<IncomeResponse> list(@AuthenticationPrincipal AppUserPrincipal user,
                                     @RequestParam(required = false) YearMonth month) {
        return service.list(user.id(), month != null ? month : YearMonth.now(clock));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public IncomeResponse create(@AuthenticationPrincipal AppUserPrincipal user,
                                 @Valid @RequestBody IncomeRequest request) {
        return service.create(user.id(), request);
    }

    @GetMapping("/{id}")
    public IncomeResponse get(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable Long id) {
        return service.get(user.id(), id);
    }

    @PutMapping("/{id}")
    public IncomeResponse update(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable Long id,
                                 @Valid @RequestBody IncomeRequest request) {
        return service.update(user.id(), id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable Long id) {
        service.delete(user.id(), id);
    }

    /** Marca un ingreso esperado como recibido (el mismo registro, sin duplicar el importe). */
    @PostMapping("/{id}/receive")
    public IncomeResponse receive(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable Long id,
                                  @RequestBody(required = false) ReceiveIncomeRequest request) {
        return service.receive(user.id(), id, request != null ? request.date() : null);
    }
}
