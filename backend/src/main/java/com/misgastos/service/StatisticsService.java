package com.misgastos.service;

import com.misgastos.dto.CategoryTotal;
import com.misgastos.dto.DashboardResponse;
import com.misgastos.dto.ExpenseResponse;
import com.misgastos.dto.StatisticsResponse;
import com.misgastos.dto.TimelinePoint;
import com.misgastos.model.Category;
import com.misgastos.model.Expense;
import com.misgastos.repository.ExpenseRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Calcula resúmenes a partir de los gastos guardados.
 * Todo es matemática simple: sumas, porcentajes y promedios.
 * Recibe "today" como parámetro para que los tests puedan fijar la fecha.
 */
@Service
@Transactional(readOnly = true)
public class StatisticsService {

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private final ExpenseRepository repository;

    public StatisticsService(ExpenseRepository repository) {
        this.repository = repository;
    }

    public DashboardResponse dashboard(YearMonth month, LocalDate today) {
        LocalDate from = month.atDay(1);
        LocalDate to = month.atEndOfMonth();
        List<Expense> expenses = find(from, to);
        BigDecimal total = sum(expenses);

        YearMonth previous = month.minusMonths(1);
        BigDecimal previousTotal = sum(find(previous.atDay(1), previous.atEndOfMonth()));

        LocalDate weekStart = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        BigDecimal weekTotal = sum(find(weekStart, weekStart.plusDays(6)));

        List<ExpenseResponse> recent = repository.findTop5ByOrderByDateDescCreatedAtDesc()
                .stream().map(ExpenseResponse::from).toList();

        return new DashboardResponse(
                month.toString(),
                total,
                previousTotal,
                changePercent(total, previousTotal),
                weekTotal,
                dailyAverage(total, from, to, today),
                expenses.size(),
                byCategory(expenses, total),
                recent);
    }

    public StatisticsResponse statistics(StatisticsPeriod period, LocalDate reference, LocalDate today) {
        LocalDate from = startOf(period, reference);
        LocalDate to = endOf(period, from);
        LocalDate previousFrom = startOf(period, previousReference(period, from));
        LocalDate previousTo = endOf(period, previousFrom);

        List<Expense> expenses = find(from, to);
        BigDecimal total = sum(expenses);
        BigDecimal previousTotal = sum(find(previousFrom, previousTo));
        List<CategoryTotal> categories = byCategory(expenses, total);

        return new StatisticsResponse(
                period,
                from,
                to,
                total,
                previousTotal,
                changePercent(total, previousTotal),
                dailyAverage(total, from, to, today),
                expenses.size(),
                categories,
                categories.isEmpty() ? null : categories.getFirst(),
                timeline(period, from, to, expenses));
    }

    // --- Rangos de fechas ---

    static LocalDate startOf(StatisticsPeriod period, LocalDate date) {
        return switch (period) {
            case WEEK -> date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            case MONTH -> date.withDayOfMonth(1);
            case YEAR -> date.withDayOfYear(1);
        };
    }

    static LocalDate endOf(StatisticsPeriod period, LocalDate start) {
        return switch (period) {
            case WEEK -> start.plusDays(6);
            case MONTH -> start.with(TemporalAdjusters.lastDayOfMonth());
            case YEAR -> start.with(TemporalAdjusters.lastDayOfYear());
        };
    }

    private static LocalDate previousReference(StatisticsPeriod period, LocalDate start) {
        return switch (period) {
            case WEEK -> start.minusWeeks(1);
            case MONTH -> start.minusMonths(1);
            case YEAR -> start.minusYears(1);
        };
    }

    // --- Cálculos ---

    private List<Expense> find(LocalDate from, LocalDate to) {
        return repository.findByDateBetweenOrderByDateDescCreatedAtDesc(from, to);
    }

    static BigDecimal sum(List<Expense> expenses) {
        return expenses.stream().map(Expense::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** Variación porcentual respecto del período anterior, o null si el anterior es cero. */
    static BigDecimal changePercent(BigDecimal current, BigDecimal previous) {
        if (previous.signum() == 0) {
            return null;
        }
        return current.subtract(previous)
                .multiply(HUNDRED)
                .divide(previous, 1, RoundingMode.HALF_UP);
    }

    static BigDecimal percent(BigDecimal part, BigDecimal total) {
        if (total.signum() == 0) {
            return BigDecimal.ZERO;
        }
        return part.multiply(HUNDRED).divide(total, 1, RoundingMode.HALF_UP);
    }

    /**
     * Promedio por día transcurrido: en el período actual cuenta solo hasta hoy,
     * en uno pasado cuenta todos los días y en uno futuro da cero.
     */
    static BigDecimal dailyAverage(BigDecimal total, LocalDate from, LocalDate to, LocalDate today) {
        if (today.isBefore(from)) {
            return BigDecimal.ZERO;
        }
        LocalDate lastDay = today.isAfter(to) ? to : today;
        long days = ChronoUnit.DAYS.between(from, lastDay) + 1;
        return total.divide(BigDecimal.valueOf(days), 2, RoundingMode.HALF_UP);
    }

    static List<CategoryTotal> byCategory(List<Expense> expenses, BigDecimal total) {
        Map<Category, BigDecimal> totals = new EnumMap<>(Category.class);
        Map<Category, Integer> counts = new EnumMap<>(Category.class);
        for (Expense e : expenses) {
            totals.merge(e.getCategory(), e.getAmount(), BigDecimal::add);
            counts.merge(e.getCategory(), 1, Integer::sum);
        }
        return totals.entrySet().stream()
                .map(entry -> new CategoryTotal(entry.getKey(), entry.getValue(),
                        percent(entry.getValue(), total), counts.get(entry.getKey())))
                .sorted(Comparator.comparing(CategoryTotal::total).reversed())
                .toList();
    }

    /** Semana y mes: un punto por día. Año: un punto por mes. */
    static List<TimelinePoint> timeline(StatisticsPeriod period, LocalDate from, LocalDate to, List<Expense> expenses) {
        List<TimelinePoint> points = new ArrayList<>();
        LocalDate start = from;
        while (!start.isAfter(to)) {
            LocalDate end = period == StatisticsPeriod.YEAR
                    ? start.with(TemporalAdjusters.lastDayOfMonth())
                    : start;
            LocalDate s = start;
            BigDecimal total = expenses.stream()
                    .filter(e -> !e.getDate().isBefore(s) && !e.getDate().isAfter(end))
                    .map(Expense::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            points.add(new TimelinePoint(start, end, total));
            start = end.plusDays(1);
        }
        return points;
    }
}
