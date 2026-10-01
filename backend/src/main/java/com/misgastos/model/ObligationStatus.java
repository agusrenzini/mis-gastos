package com.misgastos.model;

/** PENDING: falta pagar · PAID: tiene un gasto real vinculado · SKIPPED: ese mes no se paga. */
public enum ObligationStatus {
    PENDING,
    PAID,
    SKIPPED
}
