package com.misgastos.dto;

import java.time.LocalDate;

/** Gastos cargados antes de que existieran las cuentas, todavía sin dueño. */
public record UnassignedExpensesResponse(long count, LocalDate firstDate, LocalDate lastDate) {
}
