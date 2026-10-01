package com.misgastos.repository;

import com.misgastos.model.Expense;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * Todas las consultas de gastos filtran por userId: un usuario nunca ve gastos de otro.
 * No usar findById/findAll heredados desde los servicios.
 */
public interface ExpenseRepository extends JpaRepository<Expense, Long> {

    Optional<Expense> findByIdAndUserId(Long id, Long userId);

    /** Gastos entre dos fechas (ambas incluidas), del más nuevo al más viejo. */
    List<Expense> findByUserIdAndDateBetweenOrderByDateDescCreatedAtDesc(Long userId, LocalDate from, LocalDate to);

    List<Expense> findByUserIdOrderByDateDescCreatedAtDesc(Long userId);

    List<Expense> findTop5ByUserIdOrderByDateDescCreatedAtDesc(Long userId);

    /** Gastos del usuario en un rango que todavía no pagan ningún gasto fijo (para vincular sin duplicar). */
    @Query("""
            select e from Expense e
            where e.userId = :userId and e.date between :from and :to
              and not exists (select 1 from RecurringObligation o where o.expenseId = e.id)
            order by e.date desc, e.createdAt desc""")
    List<Expense> findUnlinkedBetween(@Param("userId") Long userId, @Param("from") LocalDate from,
                                      @Param("to") LocalDate to);

    // --- Solo para el panel de administración: resúmenes, nunca el detalle de los gastos ---

    interface UserActivity {
        Long getUserId();
        long getExpenseCount();
        Instant getLastExpenseAt();
    }

    @Query("""
            select e.userId as userId, count(e) as expenseCount, max(e.createdAt) as lastExpenseAt
            from Expense e where e.userId is not null group by e.userId""")
    List<UserActivity> activityByUser();

    interface UnassignedSummary {
        long getCount();
        LocalDate getFirstDate();
        LocalDate getLastDate();
    }

    @Query("""
            select count(e) as count, min(e.date) as firstDate, max(e.date) as lastDate
            from Expense e where e.userId is null""")
    UnassignedSummary unassignedSummary();

    @Modifying
    @Query("update Expense e set e.userId = :userId where e.userId is null")
    int assignUnassignedTo(@Param("userId") Long userId);
}
