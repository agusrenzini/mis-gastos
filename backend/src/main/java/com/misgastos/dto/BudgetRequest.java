package com.misgastos.dto;

import com.misgastos.model.Category;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.List;

/** Presupuesto completo de un mes. Las categorías que no vienen (o vienen en 0) quedan sin presupuesto. */
public record BudgetRequest(
        @NotNull(message = "Faltan las categorías")
        List<@Valid Item> items
) {
    public record Item(
            @NotNull(message = "Elegí una categoría")
            Category category,

            @NotNull(message = "Ingresá un importe")
            @DecimalMin(value = "0", message = "El importe no puede ser negativo")
            @Digits(integer = 10, fraction = 2, message = "El importe no es válido")
            BigDecimal amount
    ) {
    }
}
