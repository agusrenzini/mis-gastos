package com.misgastos.repository;

import com.misgastos.model.Expense;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface ExpenseRepository extends JpaRepository<Expense, Long> {

    /** Gastos entre dos fechas (ambas incluidas), del más nuevo al más viejo. */
    List<Expense> findByDateBetweenOrderByDateDescCreatedAtDesc(LocalDate from, LocalDate to);

    List<Expense> findAllByOrderByDateDescCreatedAtDesc();

    List<Expense> findTop5ByOrderByDateDescCreatedAtDesc();
}
