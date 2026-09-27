package com.misgastos.dto;

import com.misgastos.model.Category;
import com.misgastos.model.ExpenseSource;
import com.misgastos.model.PaymentMethod;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Datos que manda el frontend para crear o modificar un gasto. */
public record ExpenseRequest(
        @NotNull(message = "Ingresá el importe")
        @DecimalMin(value = "0.01", message = "El importe tiene que ser mayor a cero")
        @Digits(integer = 10, fraction = 2, message = "El importe no es válido")
        BigDecimal amount,

        @NotBlank(message = "Escribí una descripción")
        @Size(max = 120, message = "La descripción puede tener hasta 120 caracteres")
        String description,

        @NotNull(message = "Elegí una fecha")
        @PastOrPresent(message = "La fecha no puede ser futura")
        LocalDate date,

        @NotNull(message = "Elegí una categoría")
        Category category,

        @NotNull(message = "Elegí la forma de pago")
        PaymentMethod paymentMethod,

        ExpenseSource source,

        @Size(max = 500, message = "La transcripción es demasiado larga")
        String voiceTranscript
) {
}
