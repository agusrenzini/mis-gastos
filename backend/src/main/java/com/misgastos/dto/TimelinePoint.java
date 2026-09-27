package com.misgastos.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Un tramo del gráfico de evolución: un día (semana/mes) o un mes (año). */
public record TimelinePoint(LocalDate start, LocalDate end, BigDecimal total) {
}
