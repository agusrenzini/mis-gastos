package com.misgastos.dto;

import com.misgastos.model.Role;

import java.time.Instant;

/** Una fila del panel: datos de la cuenta y resumen de actividad. Sin contraseñas ni detalle de gastos. */
public record AdminUserResponse(
        Long id,
        String username,
        Role role,
        boolean active,
        boolean mustChangePassword,
        Instant createdAt,
        long expenseCount,
        Instant lastExpenseAt
) {
}
