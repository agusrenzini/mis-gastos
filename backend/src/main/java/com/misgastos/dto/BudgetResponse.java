package com.misgastos.dto;

import com.misgastos.model.Category;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.List;

/**
 * Presupuesto del mes y resumen. Ningún importe es un "saldo de cuenta": no se conoce el saldo inicial.
 * overPlanned: el total presupuestado supera los ingresos planificados (solo es un aviso).
 */
public record BudgetResponse(
        YearMonth month,
        Summary summary,
        List<CategoryLine> categories,
        boolean hasBudget,
        boolean hasPreviousBudget,
        boolean overPlanned
) {
    /**
     * plannedIncome = recibidos + esperados pendientes (cada ingreso cuenta una sola vez, según su estado).
     * registeredBalance = recibidos - gastos reales.
     * balanceAfterPending = recibidos - gastos reales - fijos pendientes.
     * unassignedPlannedIncome = ingresos planificados - presupuesto total.
     */
    public record Summary(
            BigDecimal incomeReceived,
            BigDecimal incomeExpectedPending,
            BigDecimal plannedIncome,
            BigDecimal expenses,
            BigDecimal registeredBalance,
            BigDecimal pendingRecurring,
            BigDecimal balanceAfterPending,
            BigDecimal budgetTotal,
            BigDecimal unassignedPlannedIncome
    ) {
    }

    /** remaining = budget - spent - pendingRecurring. exceeded: hay presupuesto y remaining es negativo. */
    public record CategoryLine(
            Category category,
            boolean assigned,
            BigDecimal budget,
            BigDecimal spent,
            BigDecimal pendingRecurring,
            BigDecimal remaining,
            boolean exceeded
    ) {
    }
}
