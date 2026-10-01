package com.misgastos.repository;

import com.misgastos.model.BudgetItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.YearMonth;
import java.util.List;

public interface BudgetItemRepository extends JpaRepository<BudgetItem, Long> {

    List<BudgetItem> findByUserIdAndMonth(Long userId, YearMonth month);

    boolean existsByUserIdAndMonth(Long userId, YearMonth month);
}
