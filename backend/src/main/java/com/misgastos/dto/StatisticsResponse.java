package com.misgastos.dto;

import com.misgastos.service.StatisticsPeriod;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record StatisticsResponse(
        StatisticsPeriod period,
        LocalDate from,
        LocalDate to,
        BigDecimal total,
        BigDecimal previousTotal,
        BigDecimal changePercent,
        BigDecimal dailyAverage,
        int expenseCount,
        List<CategoryTotal> byCategory,
        CategoryTotal topCategory,
        List<TimelinePoint> timeline
) {
}
