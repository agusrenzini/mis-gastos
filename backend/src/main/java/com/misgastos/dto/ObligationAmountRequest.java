package com.misgastos.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/** Ajuste del importe de un mes (por ejemplo, cuando la factura vino distinta). */
public record ObligationAmountRequest(
        @NotNull(message = "Ingresá el importe")
        @DecimalMin(value = "0.01", message = "El importe tiene que ser mayor a cero")
        @Digits(integer = 10, fraction = 2, message = "El importe no es válido")
        BigDecimal amount
) {
}
