package com.misgastos.controller;

import com.misgastos.dto.AdminUserResponse;
import com.misgastos.dto.TemporaryPasswordResponse;
import com.misgastos.dto.UnassignedExpensesResponse;
import com.misgastos.security.AppUserPrincipal;
import com.misgastos.service.AdminService;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Panel de administración. Protegido dos veces: por URL en SecurityConfig (/api/admin/**)
 * y acá con @PreAuthorize, por si alguna vez cambia la configuración de rutas.
 */
@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final AdminService service;

    public AdminController(AdminService service) {
        this.service = service;
    }

    @GetMapping("/users")
    public List<AdminUserResponse> users() {
        return service.listUsers();
    }

    @PostMapping("/users/{id}/deactivate")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deactivate(@AuthenticationPrincipal AppUserPrincipal admin, @PathVariable Long id) {
        service.setActive(admin.id(), id, false);
    }

    @PostMapping("/users/{id}/activate")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void activate(@AuthenticationPrincipal AppUserPrincipal admin, @PathVariable Long id) {
        service.setActive(admin.id(), id, true);
    }

    @PostMapping("/users/{id}/reset-password")
    public TemporaryPasswordResponse resetPassword(@AuthenticationPrincipal AppUserPrincipal admin,
                                                   @PathVariable Long id) {
        return service.resetPassword(admin.id(), id);
    }

    @GetMapping("/unassigned-expenses")
    public UnassignedExpensesResponse unassignedExpenses() {
        return service.unassignedExpenses();
    }

    public record AssignResult(int assigned) {
    }

    @PostMapping("/unassigned-expenses/assign-to-me")
    public AssignResult assignUnassignedToMe(@AuthenticationPrincipal AppUserPrincipal admin) {
        return new AssignResult(service.assignUnassignedTo(admin.id()));
    }
}
