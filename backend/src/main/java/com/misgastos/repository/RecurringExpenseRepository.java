package com.misgastos.repository;

import com.misgastos.model.RecurringExpense;
import com.misgastos.model.RecurringStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RecurringExpenseRepository extends JpaRepository<RecurringExpense, Long> {

    Optional<RecurringExpense> findByIdAndUserId(Long id, Long userId);

    List<RecurringExpense> findByUserIdOrderByDueDayAscDescriptionAsc(Long userId);

    List<RecurringExpense> findByUserIdAndStatus(Long userId, RecurringStatus status);
}
