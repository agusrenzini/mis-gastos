package com.misgastos.dto;

import com.misgastos.model.Category;
import com.misgastos.model.ObligationStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;

/**
 * La obligación de un gasto fijo en un mes.
 * Si está pagada, paidAmount y paidDate son los del gasto real (pueden diferir de lo previsto).
 */
public record ObligationResponse(
        Long id,
        Long recurringId,
        YearMonth month,
        LocalDate dueDate,
        String description,
        Category category,
        BigDecimal amount,
        boolean amountAdjusted,
        ObligationStatus status,
        boolean overdue,
        Long expenseId,
        boolean expenseCreated,
        BigDecimal paidAmount,
        LocalDate paidDate
) {
}
