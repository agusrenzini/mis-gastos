package com.misgastos.service;

import com.misgastos.dto.AdminUserResponse;
import com.misgastos.dto.TemporaryPasswordResponse;
import com.misgastos.dto.UnassignedExpensesResponse;
import com.misgastos.model.AppUser;
import com.misgastos.repository.AppUserRepository;
import com.misgastos.repository.ExpenseRepository;
import com.misgastos.repository.ExpenseRepository.UserActivity;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Funciones del panel de administración. Solo devuelve resúmenes de actividad:
 * nunca contraseñas, hashes ni el detalle de los gastos de otros usuarios.
 */
@Service
public class AdminService {

    /** Sin letras ni números que se confundan (l, 1, o, 0) para dictarla sin errores. */
    private static final String TEMP_PASSWORD_CHARS = "abcdefghijkmnpqrstuvwxyz23456789";

    private final AppUserRepository users;
    private final ExpenseRepository expenses;
    private final PasswordEncoder encoder;
    private final SecureRandom random = new SecureRandom();

    public AdminService(AppUserRepository users, ExpenseRepository expenses, PasswordEncoder encoder) {
        this.users = users;
        this.expenses = expenses;
        this.encoder = encoder;
    }

    @Transactional(readOnly = true)
    public List<AdminUserResponse> listUsers() {
        Map<Long, UserActivity> activity = expenses.activityByUser().stream()
                .collect(Collectors.toMap(UserActivity::getUserId, Function.identity()));
        return users.findAllByOrderByCreatedAtAsc().stream()
                .map(user -> {
                    UserActivity a = activity.get(user.getId());
                    return new AdminUserResponse(user.getId(), user.getUsername(), user.getRole(), user.isActive(),
                            user.isMustChangePassword(), user.getCreatedAt(),
                            a != null ? a.getExpenseCount() : 0,
                            a != null ? a.getLastExpenseAt() : null);
                })
                .toList();
    }

    /** Desactivar no borra nada: la cuenta conserva sus gastos y se puede reactivar. */
    @Transactional
    public void setActive(Long adminId, Long userId, boolean active) {
        if (adminId.equals(userId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "No podés desactivar tu propia cuenta.");
        }
        AppUser user = find(userId);
        user.setActive(active);
    }

    /**
     * Genera una contraseña temporal nueva. La anterior no se puede consultar (solo existe su hash)
     * y deja de funcionar. El usuario tiene que cambiar la temporal al entrar.
     */
    @Transactional
    public TemporaryPasswordResponse resetPassword(Long adminId, Long userId) {
        if (adminId.equals(userId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Para cambiar tu propia contraseña usá Ajustes.");
        }
        AppUser user = find(userId);
        String temporary = temporaryPassword();
        user.setPasswordHash(encoder.encode(temporary));
        user.setMustChangePassword(true);
        return new TemporaryPasswordResponse(user.getUsername(), temporary);
    }

    @Transactional(readOnly = true)
    public UnassignedExpensesResponse unassignedExpenses() {
        ExpenseRepository.UnassignedSummary summary = expenses.unassignedSummary();
        return new UnassignedExpensesResponse(summary.getCount(), summary.getFirstDate(), summary.getLastDate());
    }

    /** Asigna al administrador los gastos cargados antes de que existieran las cuentas. */
    @Transactional
    public int assignUnassignedTo(Long adminId) {
        return expenses.assignUnassignedTo(adminId);
    }

    private AppUser find(Long userId) {
        return users.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "El usuario no existe."));
    }

    /** Formato xxxx-xxxx-xxxx: fácil de dictar o copiar. */
    private String temporaryPassword() {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 12; i++) {
            if (i > 0 && i % 4 == 0) {
                sb.append('-');
            }
            sb.append(TEMP_PASSWORD_CHARS.charAt(random.nextInt(TEMP_PASSWORD_CHARS.length())));
        }
        return sb.toString();
    }
}
