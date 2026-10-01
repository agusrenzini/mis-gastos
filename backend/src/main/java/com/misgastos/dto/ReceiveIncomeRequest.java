package com.misgastos.dto;

import java.time.LocalDate;

/** Fecha de cobro opcional. Sin fecha se usa la esperada (o hoy, si la esperada todavía no llegó). */
public record ReceiveIncomeRequest(LocalDate date) {
}
