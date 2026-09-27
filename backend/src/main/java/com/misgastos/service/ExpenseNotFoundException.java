package com.misgastos.service;

public class ExpenseNotFoundException extends RuntimeException {

    public ExpenseNotFoundException(Long id) {
        super("No existe el gasto " + id);
    }
}
