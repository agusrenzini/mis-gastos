package com.misgastos.dto;

import com.misgastos.model.Income;
import com.misgastos.model.IncomeStatus;
import com.misgastos.model.IncomeType;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record IncomeResponse(
        Long id,
        String description,
        BigDecimal amount,
        LocalDate date,
        IncomeType type,
        IncomeStatus status,
        Instant createdAt,
        Instant updatedAt
) {
    public static IncomeResponse from(Income i) {
        return new IncomeResponse(i.getId(), i.getDescription(), i.getAmount(), i.getDate(), i.getType(),
                i.getStatus(), i.getCreatedAt(), i.getUpdatedAt());
    }
}
