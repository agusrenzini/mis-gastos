package com.misgastos.controller;

import com.misgastos.dto.ExpenseResponse;
import com.misgastos.dto.LinkObligationRequest;
import com.misgastos.dto.ObligationAmountRequest;
import com.misgastos.dto.ObligationResponse;
import com.misgastos.dto.PayObligationRequest;
import com.misgastos.dto.RecurringRequest;
import com.misgastos.dto.RecurringResponse;
import com.misgastos.security.AppUserPrincipal;
import com.misgastos.service.RecurringService;
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

import java.time.YearMonth;
import java.util.List;

/** Gastos fijos (configuración) y sus obligaciones mensuales, siempre del usuario con sesión iniciada. */
@RestController
@RequestMapping("/api/recurring")
public class RecurringController {

    private final RecurringService service;

    public RecurringController(RecurringService service) {
        this.service = service;
    }

    // ---------- Configuración ----------

    @GetMapping
    public List<RecurringResponse> list(@AuthenticationPrincipal AppUserPrincipal user) {
        return service.list(user.id());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RecurringResponse create(@AuthenticationPrincipal AppUserPrincipal user,
                                    @Valid @RequestBody RecurringRequest request) {
        return service.create(user.id(), request);
    }

    @GetMapping("/{id}")
    public RecurringResponse get(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable Long id) {
        return service.get(user.id(), id);
    }

    @PutMapping("/{id}")
    public RecurringResponse update(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable Long id,
                                    @Valid @RequestBody RecurringRequest request) {
        return service.update(user.id(), id, request);
    }

    @PostMapping("/{id}/pause")
    public RecurringResponse pause(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable Long id) {
        return service.pause(user.id(), id);
    }

    @PostMapping("/{id}/resume")
    public RecurringResponse resume(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable Long id) {
        return service.resume(user.id(), id);
    }

    @PostMapping("/{id}/finish")
    public RecurringResponse finish(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable Long id) {
        return service.finish(user.id(), id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable Long id) {
        service.delete(user.id(), id);
    }

    // ---------- Obligaciones de cada mes ----------

    /** Ejemplo: GET /api/recurring/obligations?month=2026-10. Genera las que falten. */
    @GetMapping("/obligations")
    public List<ObligationResponse> obligations(@AuthenticationPrincipal AppUserPrincipal user,
                                                @RequestParam(required = false) YearMonth month) {
        return service.obligationsOf(user.id(), month != null ? month : service.currentMonth());
    }

    @GetMapping("/obligations/{id}")
    public ObligationResponse obligation(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable Long id) {
        return service.obligation(user.id(), id);
    }

    @PutMapping("/obligations/{id}/amount")
    public ObligationResponse adjustAmount(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable Long id,
                                           @Valid @RequestBody ObligationAmountRequest request) {
        return service.adjustAmount(user.id(), id, request.amount());
    }

    @PostMapping("/obligations/{id}/pay")
    public ObligationResponse pay(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable Long id,
                                  @Valid @RequestBody PayObligationRequest request) {
        return service.pay(user.id(), id, request);
    }

    @PostMapping("/obligations/{id}/link")
    public ObligationResponse link(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable Long id,
                                   @Valid @RequestBody LinkObligationRequest request) {
        return service.link(user.id(), id, request.expenseId());
    }

    @GetMapping("/obligations/{id}/candidates")
    public List<ExpenseResponse> candidates(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable Long id) {
        return service.linkCandidates(user.id(), id);
    }

    @PostMapping("/obligations/{id}/unpay")
    public ObligationResponse unpay(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable Long id) {
        return service.unpay(user.id(), id);
    }

    @PostMapping("/obligations/{id}/skip")
    public ObligationResponse skip(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable Long id) {
        return service.skip(user.id(), id);
    }

    @PostMapping("/obligations/{id}/restore")
    public ObligationResponse restore(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable Long id) {
        return service.restore(user.id(), id);
    }
}
