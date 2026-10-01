package com.misgastos.dto;

import jakarta.validation.constraints.NotNull;

/** Vincular un gasto ya cargado como pago de un mes (evita cargarlo dos veces). */
public record LinkObligationRequest(
        @NotNull(message = "Elegí un gasto")
        Long expenseId
) {
}
