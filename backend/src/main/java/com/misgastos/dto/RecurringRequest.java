package com.misgastos.dto;

import com.misgastos.model.Category;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.YearMonth;

/** Configuración de un gasto fijo mensual. El estado (activo o pausado) se cambia con sus propias acciones. */
public record RecurringRequest(
        @NotBlank(message = "Escribí un concepto")
        @Size(max = 120, message = "El concepto puede tener hasta 120 caracteres")
        String description,

        @NotNull(message = "Elegí una categoría")
        Category category,

        @NotNull(message = "Ingresá el importe previsto")
        @DecimalMin(value = "0.01", message = "El importe tiene que ser mayor a cero")
        @Digits(integer = 10, fraction = 2, message = "El importe no es válido")
        BigDecimal amount,

        @NotNull(message = "Elegí el día de vencimiento")
        @Min(value = 1, message = "El día tiene que estar entre 1 y 31")
        @Max(value = 31, message = "El día tiene que estar entre 1 y 31")
        Integer dueDay,

        @NotNull(message = "Elegí el mes de inicio")
        YearMonth startMonth,

        YearMonth endMonth
) {
}
