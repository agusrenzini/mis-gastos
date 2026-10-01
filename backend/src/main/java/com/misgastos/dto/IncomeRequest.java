package com.misgastos.dto;

import com.misgastos.model.IncomeStatus;
import com.misgastos.model.IncomeType;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Datos para crear o modificar un ingreso. */
public record IncomeRequest(
        @NotBlank(message = "Escribí un concepto")
        @Size(max = 120, message = "El concepto puede tener hasta 120 caracteres")
        String description,

        @NotNull(message = "Ingresá el importe")
        @DecimalMin(value = "0.01", message = "El importe tiene que ser mayor a cero")
        @Digits(integer = 10, fraction = 2, message = "El importe no es válido")
        BigDecimal amount,

        @NotNull(message = "Elegí una fecha")
        LocalDate date,

        @NotNull(message = "Elegí el tipo de ingreso")
        IncomeType type,

        @NotNull(message = "Indicá si ya lo cobraste")
        IncomeStatus status
) {
}
