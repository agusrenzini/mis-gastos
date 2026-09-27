package com.misgastos.dto;

import com.misgastos.model.Category;
import com.misgastos.model.Expense;
import com.misgastos.model.ExpenseSource;
import com.misgastos.model.PaymentMethod;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record ExpenseResponse(
        Long id,
        BigDecimal amount,
        String description,
        LocalDate date,
        Category category,
        PaymentMethod paymentMethod,
        ExpenseSource source,
        String voiceTranscript,
        Instant createdAt,
        Instant updatedAt
) {
    public static ExpenseResponse from(Expense e) {
        return new ExpenseResponse(e.getId(), e.getAmount(), e.getDescription(), e.getDate(),
                e.getCategory(), e.getPaymentMethod(), e.getSource(), e.getVoiceTranscript(),
                e.getCreatedAt(), e.getUpdatedAt());
    }
}
