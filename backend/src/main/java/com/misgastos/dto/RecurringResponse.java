package com.misgastos.dto;

import com.misgastos.model.Category;
import com.misgastos.model.RecurringStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;

/**
 * Un gasto fijo con su situación actual.
 * state: ACTIVE, PAUSED, SCHEDULED (empieza más adelante) o FINISHED (ya pasó el mes de fin).
 */
public record RecurringResponse(
        Long id,
        String description,
        Category category,
        BigDecimal amount,
        int dueDay,
        YearMonth startMonth,
        YearMonth endMonth,
        RecurringStatus status,
        String state,
        LocalDate nextDueDate,
        int paidCount,
        int overdueCount
) {
}
