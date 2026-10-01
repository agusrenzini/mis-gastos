package com.misgastos.controller;

import com.misgastos.dto.DashboardResponse;
import com.misgastos.dto.StatisticsResponse;
import com.misgastos.security.AppUserPrincipal;
import com.misgastos.service.StatisticsPeriod;
import com.misgastos.service.StatisticsService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;

@RestController
@RequestMapping("/api")
public class StatisticsController {

    private final StatisticsService service;
    private final Clock clock;

    public StatisticsController(StatisticsService service, Clock clock) {
        this.service = service;
        this.clock = clock;
    }

    /** Ejemplo: GET /api/dashboard?month=2026-09 (sin month usa el mes actual). */
    @GetMapping("/dashboard")
    public DashboardResponse dashboard(@AuthenticationPrincipal AppUserPrincipal user,
                                       @RequestParam(required = false) String month) {
        LocalDate today = LocalDate.now(clock);
        YearMonth yearMonth = month == null ? YearMonth.from(today) : YearMonth.parse(month);
        return service.dashboard(user.id(), yearMonth, today);
    }

    /**
     * Ejemplo: GET /api/statistics?period=MONTH&date=2026-09-26
     * Devuelve el período (semana, mes o año) que contiene a "date" y lo compara con el anterior.
     */
    @GetMapping("/statistics")
    public StatisticsResponse statistics(
            @AuthenticationPrincipal AppUserPrincipal user,
            @RequestParam(defaultValue = "MONTH") StatisticsPeriod period,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        LocalDate today = LocalDate.now(clock);
        return service.statistics(user.id(), period, date != null ? date : today, today);
    }
}
