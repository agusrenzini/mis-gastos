package com.misgastos.service;

import com.misgastos.dto.StatisticsResponse;
import com.misgastos.model.Category;
import com.misgastos.model.Expense;
import com.misgastos.repository.ExpenseRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Prueba los cálculos sin base de datos (el repositorio es un mock). */
class StatisticsServiceTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 9, 26); // sábado
    private static final Long USER_ID = 7L;

    private static Expense expense(String amount, String date, Category category) {
        Expense e = new Expense();
        e.setAmount(new BigDecimal(amount));
        e.setDate(LocalDate.parse(date));
        e.setCategory(category);
        return e;
    }

    @Test
    void weekRunsMondayToSunday() {
        assertThat(StatisticsService.startOf(StatisticsPeriod.WEEK, TODAY)).isEqualTo("2026-09-21");
        assertThat(StatisticsService.endOf(StatisticsPeriod.WEEK, LocalDate.parse("2026-09-21")))
                .isEqualTo("2026-09-27");
    }

    @Test
    void changePercentComparesWithPreviousPeriod() {
        assertThat(StatisticsService.changePercent(new BigDecimal("112.4"), new BigDecimal("100")))
                .isEqualByComparingTo("12.4");
        assertThat(StatisticsService.changePercent(new BigDecimal("50"), new BigDecimal("100")))
                .isEqualByComparingTo("-50");
        assertThat(StatisticsService.changePercent(new BigDecimal("50"), BigDecimal.ZERO)).isNull();
    }

    @Test
    void dailyAverageOnlyCountsElapsedDays() {
        LocalDate from = LocalDate.parse("2026-09-01");
        LocalDate to = LocalDate.parse("2026-09-30");
        // Mes en curso: 26 días transcurridos
        assertThat(StatisticsService.dailyAverage(new BigDecimal("2600"), from, to, TODAY))
                .isEqualByComparingTo("100");
        // Mes pasado: los 30 días
        assertThat(StatisticsService.dailyAverage(new BigDecimal("3000"), from, to, LocalDate.parse("2026-10-05")))
                .isEqualByComparingTo("100");
        // Mes futuro: cero
        assertThat(StatisticsService.dailyAverage(new BigDecimal("3000"), from, to, LocalDate.parse("2026-08-05")))
                .isEqualByComparingTo("0");
    }

    @Test
    void monthStatisticsGroupByCategoryAndDay() {
        ExpenseRepository repository = mock(ExpenseRepository.class);
        when(repository.findByUserIdAndDateBetweenOrderByDateDescCreatedAtDesc(eq(USER_ID), any(), any())).thenReturn(List.of());
        when(repository.findByUserIdAndDateBetweenOrderByDateDescCreatedAtDesc(eq(USER_ID),
                eq(LocalDate.parse("2026-09-01")), eq(LocalDate.parse("2026-09-30"))))
                .thenReturn(List.of(
                        expense("6000", "2026-09-26", Category.COMIDA),
                        expense("3000", "2026-09-02", Category.TRANSPORTE),
                        expense("1000", "2026-09-02", Category.COMIDA)));
        when(repository.findByUserIdAndDateBetweenOrderByDateDescCreatedAtDesc(eq(USER_ID),
                eq(LocalDate.parse("2026-08-01")), eq(LocalDate.parse("2026-08-31"))))
                .thenReturn(List.of(expense("8000", "2026-08-10", Category.OTROS)));

        StatisticsResponse stats = new StatisticsService(repository)
                .statistics(USER_ID, StatisticsPeriod.MONTH, TODAY, TODAY);

        assertThat(stats.total()).isEqualByComparingTo("10000");
        assertThat(stats.previousTotal()).isEqualByComparingTo("8000");
        assertThat(stats.changePercent()).isEqualByComparingTo("25");
        assertThat(stats.topCategory().category()).isEqualTo(Category.COMIDA);
        assertThat(stats.topCategory().total()).isEqualByComparingTo("7000");
        assertThat(stats.topCategory().percent()).isEqualByComparingTo("70");
        assertThat(stats.timeline()).hasSize(30);
        assertThat(stats.timeline().get(1).total()).isEqualByComparingTo("4000");
        assertThat(stats.timeline().get(25).total()).isEqualByComparingTo("6000");
    }

    @Test
    void yearTimelineHasTwelveMonths() {
        ExpenseRepository repository = mock(ExpenseRepository.class);
        when(repository.findByUserIdAndDateBetweenOrderByDateDescCreatedAtDesc(eq(USER_ID), any(), any()))
                .thenReturn(List.of(expense("500", "2026-03-15", Category.SALUD)));

        StatisticsResponse stats = new StatisticsService(repository)
                .statistics(USER_ID, StatisticsPeriod.YEAR, TODAY, TODAY);

        assertThat(stats.from()).isEqualTo("2026-01-01");
        assertThat(stats.to()).isEqualTo("2026-12-31");
        assertThat(stats.timeline()).hasSize(12);
        assertThat(stats.timeline().get(2).total()).isEqualByComparingTo("500");
        assertThat(stats.timeline().get(2).end()).isEqualTo("2026-03-31");
    }
}
