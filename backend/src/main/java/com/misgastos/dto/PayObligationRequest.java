package com.misgastos.dto;

import com.misgastos.model.PaymentMethod;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Pagar un mes: se registra un gasto real con estos datos. */
public record PayObligationRequest(
        @NotNull(message = "Ingresá el importe")
        @DecimalMin(value = "0.01", message = "El importe tiene que ser mayor a cero")
        @Digits(integer = 10, fraction = 2, message = "El importe no es válido")
        BigDecimal amount,

        @NotNull(message = "Elegí la fecha de pago")
        @PastOrPresent(message = "La fecha no puede ser futura")
        LocalDate date,

        @NotNull(message = "Elegí la forma de pago")
        PaymentMethod paymentMethod
) {
}
