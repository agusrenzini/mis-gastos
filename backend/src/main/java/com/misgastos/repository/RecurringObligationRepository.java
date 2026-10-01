package com.misgastos.repository;

import com.misgastos.model.ObligationStatus;
import com.misgastos.model.RecurringObligation;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Optional;

public interface RecurringObligationRepository extends JpaRepository<RecurringObligation, Long> {

    Optional<RecurringObligation> findByIdAndUserId(Long id, Long userId);

    /** Bloquea la fila hasta el fin de la transacción: dos pagos simultáneos no pueden pasar los dos. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<RecurringObligation> findWithLockByIdAndUserId(Long id, Long userId);

    List<RecurringObligation> findByUserIdAndMonthOrderByDueDateAscDescriptionAsc(Long userId, YearMonth month);

    List<RecurringObligation> findByRecurringIdOrderByMonthDesc(Long recurringId);

    List<RecurringObligation> findByUserId(Long userId);

    List<RecurringObligation> findByUserIdAndStatusAndDueDateBeforeOrderByDueDateAsc(
            Long userId, ObligationStatus status, LocalDate date);

    Optional<RecurringObligation> findByExpenseId(Long expenseId);

    boolean existsByExpenseId(Long expenseId);

    /**
     * Crea la obligación de un mes si todavía no existe. Idempotente: si ya existe (restricción
     * UNIQUE(recurring_id, obligation_month)) no hace nada, aunque dos pedidos lleguen a la vez.
     */
    @Modifying
    @Query(value = """
            INSERT INTO recurring_obligation (user_id, recurring_id, obligation_month, due_date, description, category,
                                              amount, amount_adjusted, status, expense_created, created_at, updated_at)
            VALUES (:userId, :recurringId, :month, :dueDate, :description, :category,
                    :amount, FALSE, 'PENDING', FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT DO NOTHING""", nativeQuery = true)
    int insertIfMissing(@Param("userId") Long userId, @Param("recurringId") Long recurringId,
                        @Param("month") LocalDate month, @Param("dueDate") LocalDate dueDate,
                        @Param("description") String description, @Param("category") String category,
                        @Param("amount") BigDecimal amount);
}
