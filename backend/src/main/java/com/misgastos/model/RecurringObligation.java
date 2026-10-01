package com.misgastos.model;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;

/**
 * Lo que hay que pagar de un gasto fijo en un mes. Se crean con un INSERT idempotente
 * (RecurringObligationRepository.insertIfMissing); por JPA solo se modifican.
 * Concepto, categoría e importe son una copia: cambiar la configuración no altera los meses pagados.
 */
@Entity
@Table(name = "recurring_obligation")
public class RecurringObligation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private Long userId;

    @Column(name = "recurring_id", nullable = false, updatable = false)
    private Long recurringId;

    @Convert(converter = YearMonthConverter.class)
    @Column(name = "obligation_month", nullable = false, updatable = false)
    private YearMonth month;

    @Column(name = "due_date", nullable = false)
    private LocalDate dueDate;

    @Column(nullable = false, length = 120)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private Category category;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    /** true si el importe de este mes se ajustó a mano: los cambios de configuración no lo pisan. */
    @Column(name = "amount_adjusted", nullable = false)
    private boolean amountAdjusted;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private ObligationStatus status;

    /** Gasto real con el que se pagó. */
    @Column(name = "expense_id")
    private Long expenseId;

    /** true si el gasto lo creó la app al pagar (al deshacer el pago se elimina). */
    @Column(name = "expense_created", nullable = false)
    private boolean expenseCreated;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public void markPaid(Long expenseId, boolean created) {
        this.status = ObligationStatus.PAID;
        this.expenseId = expenseId;
        this.expenseCreated = created;
    }

    public void markPending() {
        this.status = ObligationStatus.PENDING;
        this.expenseId = null;
        this.expenseCreated = false;
    }

    public Long getId() { return id; }

    public Long getUserId() { return userId; }

    public Long getRecurringId() { return recurringId; }

    public YearMonth getMonth() { return month; }

    public LocalDate getDueDate() { return dueDate; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Category getCategory() { return category; }
    public void setCategory(Category category) { this.category = category; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public boolean isAmountAdjusted() { return amountAdjusted; }
    public void setAmountAdjusted(boolean amountAdjusted) { this.amountAdjusted = amountAdjusted; }

    public ObligationStatus getStatus() { return status; }
    public void setStatus(ObligationStatus status) { this.status = status; }

    public Long getExpenseId() { return expenseId; }

    public boolean isExpenseCreated() { return expenseCreated; }
}
