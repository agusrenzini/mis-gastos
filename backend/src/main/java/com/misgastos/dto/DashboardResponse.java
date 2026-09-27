package com.misgastos.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Datos de la pantalla Inicio.
 * changePercent es null cuando el mes anterior no tiene gastos (no hay contra qué comparar).
 */
public record DashboardResponse(
        String month,
        BigDecimal total,
        BigDecimal previousMonthTotal,
        BigDecimal changePercent,
        BigDecimal weekTotal,
        BigDecimal dailyAverage,
        int expenseCount,
        List<CategoryTotal> byCategory,
        List<ExpenseResponse> recent
) {
}
