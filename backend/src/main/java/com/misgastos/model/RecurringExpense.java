package com.misgastos.model;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;

/** Configuración de un gasto fijo mensual. Lo que hay que pagar cada mes está en RecurringObligation. */
@Entity
@Table(name = "recurring_expense")
public class RecurringExpense {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private Long userId;

    @Column(nullable = false, length = 120)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private Category category;

    /** Importe previsto. Cada mes se puede ajustar en su obligación. */
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(name = "due_day", nullable = false)
    private short dueDay;

    @Convert(converter = YearMonthConverter.class)
    @Column(name = "start_month", nullable = false)
    private YearMonth startMonth;

    @Convert(converter = YearMonthConverter.class)
    @Column(name = "end_month")
    private YearMonth endMonth;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private RecurringStatus status = RecurringStatus.ACTIVE;

    /** Primer mes que se puede generar. Al reanudar una pausa pasa al mes actual. */
    @Convert(converter = YearMonthConverter.class)
    @Column(name = "generate_from", nullable = false)
    private YearMonth generateFrom;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    /** Si el día de vencimiento no existe en ese mes (31 en abril), vence el último día. */
    public LocalDate dueDateIn(YearMonth month) {
        return month.atDay(Math.min(dueDay, month.lengthOfMonth()));
    }

    /** true si el mes está dentro del rango configurado (inicio y fin opcional). */
    public boolean includes(YearMonth month) {
        return !month.isBefore(startMonth) && (endMonth == null || !month.isAfter(endMonth));
    }

    public Long getId() { return id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Category getCategory() { return category; }
    public void setCategory(Category category) { this.category = category; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public int getDueDay() { return dueDay; }
    public void setDueDay(int dueDay) { this.dueDay = (short) dueDay; }

    public YearMonth getStartMonth() { return startMonth; }
    public void setStartMonth(YearMonth startMonth) { this.startMonth = startMonth; }

    public YearMonth getEndMonth() { return endMonth; }
    public void setEndMonth(YearMonth endMonth) { this.endMonth = endMonth; }

    public RecurringStatus getStatus() { return status; }
    public void setStatus(RecurringStatus status) { this.status = status; }

    public YearMonth getGenerateFrom() { return generateFrom; }
    public void setGenerateFrom(YearMonth generateFrom) { this.generateFrom = generateFrom; }

    public Instant getCreatedAt() { return createdAt; }
}
