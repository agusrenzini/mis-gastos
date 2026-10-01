package com.misgastos.service;

import com.misgastos.dto.ExpenseRequest;
import com.misgastos.dto.ExpenseResponse;
import com.misgastos.dto.ObligationResponse;
import com.misgastos.dto.PayObligationRequest;
import com.misgastos.dto.RecurringRequest;
import com.misgastos.dto.RecurringResponse;
import com.misgastos.model.Expense;
import com.misgastos.model.ExpenseSource;
import com.misgastos.model.ObligationStatus;
import com.misgastos.model.RecurringExpense;
import com.misgastos.model.RecurringObligation;
import com.misgastos.model.RecurringStatus;
import com.misgastos.repository.ExpenseRepository;
import com.misgastos.repository.RecurringExpenseRepository;
import com.misgastos.repository.RecurringObligationRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Gastos fijos y sus obligaciones mensuales.
 *
 * Las obligaciones se generan "a demanda": cada vez que se consulta un mes se crean las que falten
 * hasta ese mes (o hasta el mes actual, si es anterior). No depende de ningún proceso programado,
 * así que funciona aunque el servidor haya estado suspendido, y es idempotente gracias a la
 * restricción UNIQUE(recurring_id, obligation_month).
 *
 * Reglas para conservar el historial:
 *  - Los meses pagados nunca se modifican ni se borran.
 *  - Cambiar la configuración actualiza solo los meses pendientes desde el mes actual
 *    (sin pisar importes ajustados a mano). Los meses pendientes anteriores quedan como estaban.
 *  - Pausar o finalizar elimina solo los meses futuros no pagados (que eran una proyección).
 */
@Service
public class RecurringService {

    static final int MAX_MONTHS_BACK = 12;
    static final int MAX_MONTHS_AHEAD = 24;

    private final RecurringExpenseRepository recurrings;
    private final RecurringObligationRepository obligations;
    private final ExpenseRepository expenses;
    private final ExpenseService expenseService;
    private final Clock clock;

    public RecurringService(RecurringExpenseRepository recurrings, RecurringObligationRepository obligations,
                            ExpenseRepository expenses, ExpenseService expenseService, Clock clock) {
        this.recurrings = recurrings;
        this.obligations = obligations;
        this.expenses = expenses;
        this.expenseService = expenseService;
        this.clock = clock;
    }

    public YearMonth currentMonth() {
        return YearMonth.now(clock);
    }

    /** Rechaza meses demasiado lejanos (evita generar cientos de obligaciones por error). */
    public void checkMonth(YearMonth month) {
        if (month.isAfter(currentMonth().plusMonths(MAX_MONTHS_AHEAD)) || month.getYear() < 2000) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Elegí un mes más cercano.");
        }
    }

    // ---------- Generación ----------

    /**
     * Crea las obligaciones que falten de los gastos fijos activos, hasta el mes pedido
     * (como mínimo hasta el mes actual). Llamarlo varias veces no crea duplicados.
     */
    @Transactional
    public void ensureGenerated(Long userId, YearMonth month) {
        YearMonth current = currentMonth();
        YearMonth upTo = month.isAfter(current) ? month : current;
        List<RecurringExpense> active = recurrings.findByUserIdAndStatus(userId, RecurringStatus.ACTIVE);
        if (active.isEmpty()) {
            return;
        }
        Set<String> existing = new HashSet<>();
        for (RecurringObligation o : obligations.findByUserId(userId)) {
            existing.add(o.getRecurringId() + ":" + o.getMonth());
        }
        for (RecurringExpense r : active) {
            YearMonth from = r.getGenerateFrom().isAfter(r.getStartMonth()) ? r.getGenerateFrom() : r.getStartMonth();
            YearMonth to = r.getEndMonth() != null && r.getEndMonth().isBefore(upTo) ? r.getEndMonth() : upTo;
            for (YearMonth m = from; !m.isAfter(to); m = m.plusMonths(1)) {
                if (existing.contains(r.getId() + ":" + m)) {
                    continue;
                }
                obligations.insertIfMissing(userId, r.getId(), m.atDay(1), r.dueDateIn(m),
                        r.getDescription(), r.getCategory().name(), r.getAmount());
            }
        }
    }

    // ---------- Configuración ----------

    @Transactional
    public List<RecurringResponse> list(Long userId) {
        ensureGenerated(userId, currentMonth());
        Map<Long, List<RecurringObligation>> byRecurring = obligations.findByUserId(userId).stream()
                .collect(Collectors.groupingBy(RecurringObligation::getRecurringId));
        return recurrings.findByUserIdOrderByDueDayAscDescriptionAsc(userId).stream()
                .map(r -> toResponse(r, byRecurring.getOrDefault(r.getId(), List.of())))
                .toList();
    }

    @Transactional
    public RecurringResponse get(Long userId, Long id) {
        RecurringExpense r = find(userId, id);
        ensureGenerated(userId, currentMonth());
        return toResponse(r, obligations.findByRecurringIdOrderByMonthDesc(id));
    }

    @Transactional
    public RecurringResponse create(Long userId, RecurringRequest request) {
        checkRange(request, null);
        RecurringExpense r = new RecurringExpense();
        r.setUserId(userId);
        apply(request, r);
        r.setStatus(RecurringStatus.ACTIVE);
        r.setGenerateFrom(request.startMonth());
        recurrings.saveAndFlush(r);
        ensureGenerated(userId, currentMonth());
        return toResponse(r, obligations.findByRecurringIdOrderByMonthDesc(r.getId()));
    }

    /** Los meses pagados no cambian. Los pendientes desde el mes actual toman la nueva configuración. */
    @Transactional
    public RecurringResponse update(Long userId, Long id, RecurringRequest request) {
        RecurringExpense r = find(userId, id);
        checkRange(request, r);
        // generateFrom solo va más allá del inicio si se reanudó una pausa; si no, acompaña al inicio.
        boolean resumedAfterPause = r.getGenerateFrom().isAfter(r.getStartMonth());
        apply(request, r);
        r.setGenerateFrom(resumedAfterPause && r.getGenerateFrom().isAfter(request.startMonth())
                ? r.getGenerateFrom() : request.startMonth());
        recurrings.saveAndFlush(r);

        YearMonth current = currentMonth();
        for (RecurringObligation o : obligations.findByRecurringIdOrderByMonthDesc(id)) {
            if (o.getStatus() == ObligationStatus.PAID) {
                continue;
            }
            if (!r.includes(o.getMonth())) {
                obligations.delete(o); // quedó fuera del nuevo rango y no estaba pagada
            } else if (o.getStatus() == ObligationStatus.PENDING && !o.getMonth().isBefore(current)) {
                o.setDescription(r.getDescription());
                o.setCategory(r.getCategory());
                o.setDueDate(r.dueDateIn(o.getMonth()));
                if (!o.isAmountAdjusted()) {
                    o.setAmount(r.getAmount());
                }
            }
        }
        obligations.flush();
        ensureGenerated(userId, current);
        return toResponse(r, obligations.findByRecurringIdOrderByMonthDesc(id));
    }

    /** Deja de generar meses. El mes actual (si ya existe) y los anteriores se conservan. */
    @Transactional
    public RecurringResponse pause(Long userId, Long id) {
        RecurringExpense r = find(userId, id);
        r.setStatus(RecurringStatus.PAUSED);
        deleteUnpaidAfter(id, currentMonth());
        return toResponse(r, obligations.findByRecurringIdOrderByMonthDesc(id));
    }

    /** Vuelve a generar desde el mes actual: los meses en que estuvo pausado no se generan. */
    @Transactional
    public RecurringResponse resume(Long userId, Long id) {
        RecurringExpense r = find(userId, id);
        YearMonth current = currentMonth();
        if (r.getStatus() == RecurringStatus.PAUSED) {
            r.setStatus(RecurringStatus.ACTIVE);
            if (r.getGenerateFrom().isBefore(current)) {
                r.setGenerateFrom(current);
            }
            recurrings.saveAndFlush(r);
        }
        ensureGenerated(userId, current);
        return toResponse(r, obligations.findByRecurringIdOrderByMonthDesc(id));
    }

    /** Termina el gasto fijo en el mes actual. Se conservan todos los meses hasta hoy. */
    @Transactional
    public RecurringResponse finish(Long userId, Long id) {
        RecurringExpense r = find(userId, id);
        YearMonth current = currentMonth();
        if (r.getStartMonth().isAfter(current)) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Este gasto fijo todavía no empezó. Si ya no lo necesitás, eliminalo.");
        }
        if (r.getEndMonth() == null || r.getEndMonth().isAfter(current)) {
            r.setEndMonth(current);
        }
        recurrings.saveAndFlush(r);
        deleteUnpaidAfter(id, r.getEndMonth());
        return toResponse(r, obligations.findByRecurringIdOrderByMonthDesc(id));
    }

    /** Solo se puede eliminar si nunca se pagó: si tiene historial, hay que finalizarlo. */
    @Transactional
    public void delete(Long userId, Long id) {
        RecurringExpense r = find(userId, id);
        List<RecurringObligation> all = obligations.findByRecurringIdOrderByMonthDesc(id);
        if (all.stream().anyMatch(o -> o.getStatus() == ObligationStatus.PAID)) {
            throw new ApiException(HttpStatus.CONFLICT,
                    "Tiene meses pagados. Usá Finalizar para dejar de generarlo y conservar el historial.");
        }
        obligations.deleteAll(all);
        obligations.flush();
        recurrings.delete(r);
    }

    // ---------- Obligaciones ----------

    @Transactional
    public List<ObligationResponse> obligationsOf(Long userId, YearMonth month) {
        checkMonth(month);
        ensureGenerated(userId, month);
        return toResponses(userId, obligations.findByUserIdAndMonthOrderByDueDateAscDescriptionAsc(userId, month));
    }

    @Transactional(readOnly = true)
    public ObligationResponse obligation(Long userId, Long id) {
        return toResponses(userId, List.of(findObligation(userId, id))).getFirst();
    }

    /** Ajusta el importe de un mes pendiente (por ejemplo, si la factura vino distinta). */
    @Transactional
    public ObligationResponse adjustAmount(Long userId, Long id, BigDecimal amount) {
        RecurringObligation o = lockPending(userId, id);
        o.setAmount(amount);
        o.setAmountAdjusted(true);
        obligations.saveAndFlush(o);
        return obligation(userId, id);
    }

    /**
     * Paga un mes: crea el gasto real con la misma lógica que la carga manual y lo vincula.
     * La fila queda bloqueada durante la operación, así que no se puede pagar dos veces.
     */
    @Transactional
    public ObligationResponse pay(Long userId, Long id, PayObligationRequest request) {
        RecurringObligation o = lockPending(userId, id);
        ExpenseResponse expense = expenseService.create(userId, new ExpenseRequest(request.amount(),
                o.getDescription(), request.date(), o.getCategory(), request.paymentMethod(),
                ExpenseSource.MANUAL, null));
        if (request.amount().compareTo(o.getAmount()) != 0) {
            o.setAmount(request.amount());
            o.setAmountAdjusted(true);
        }
        o.markPaid(expense.id(), true);
        obligations.saveAndFlush(o);
        return obligation(userId, id);
    }

    /** Marca un mes como pagado con un gasto que ya estaba cargado (no se crea otro). */
    @Transactional
    public ObligationResponse link(Long userId, Long id, Long expenseId) {
        RecurringObligation o = lockPending(userId, id);
        expenses.findByIdAndUserId(expenseId, userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "El gasto no existe o ya fue eliminado."));
        if (obligations.existsByExpenseId(expenseId)) {
            throw new ApiException(HttpStatus.CONFLICT, "Ese gasto ya está vinculado a otro gasto fijo.");
        }
        o.markPaid(expenseId, false);
        try {
            obligations.saveAndFlush(o);
        } catch (DataIntegrityViolationException e) {
            throw new ApiException(HttpStatus.CONFLICT, "Ese gasto ya está vinculado a otro gasto fijo.");
        }
        return obligation(userId, id);
    }

    /** Gastos cercanos al mes que todavía no pagan ningún gasto fijo. */
    @Transactional(readOnly = true)
    public List<ExpenseResponse> linkCandidates(Long userId, Long id) {
        RecurringObligation o = findObligation(userId, id);
        return expenses.findUnlinkedBetween(userId, o.getMonth().minusMonths(1).atDay(1),
                        o.getMonth().plusMonths(1).atEndOfMonth())
                .stream().map(ExpenseResponse::from).toList();
    }

    /**
     * Deshace el pago: el mes vuelve a pendiente. Si el gasto lo creó la app al pagar, se elimina;
     * si era un gasto que ya existía, solo se desvincula.
     */
    @Transactional
    public ObligationResponse unpay(Long userId, Long id) {
        RecurringObligation o = lock(userId, id);
        if (o.getStatus() != ObligationStatus.PAID) {
            throw new ApiException(HttpStatus.CONFLICT, "Este mes no está pagado.");
        }
        Long expenseId = o.getExpenseId();
        boolean created = o.isExpenseCreated();
        o.markPending();
        obligations.saveAndFlush(o);
        if (created) {
            expenses.findByIdAndUserId(expenseId, userId).ifPresent(expenses::delete);
        }
        return obligation(userId, id);
    }

    /** Ese mes no se paga (por ejemplo, se canceló el servicio un mes). Se puede restaurar. */
    @Transactional
    public ObligationResponse skip(Long userId, Long id) {
        RecurringObligation o = lockPending(userId, id);
        o.setStatus(ObligationStatus.SKIPPED);
        obligations.saveAndFlush(o);
        return obligation(userId, id);
    }

    @Transactional
    public ObligationResponse restore(Long userId, Long id) {
        RecurringObligation o = lock(userId, id);
        if (o.getStatus() != ObligationStatus.SKIPPED) {
            throw new ApiException(HttpStatus.CONFLICT, "Este mes no está omitido.");
        }
        o.setStatus(ObligationStatus.PENDING);
        obligations.saveAndFlush(o);
        return obligation(userId, id);
    }

    // ---------- Ayudas ----------

    private RecurringExpense find(Long userId, Long id) {
        return recurrings.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "El gasto fijo no existe o ya fue eliminado."));
    }

    private RecurringObligation findObligation(Long userId, Long id) {
        return obligations.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Ese mes no existe."));
    }

    private RecurringObligation lock(Long userId, Long id) {
        return obligations.findWithLockByIdAndUserId(id, userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Ese mes no existe."));
    }

    private RecurringObligation lockPending(Long userId, Long id) {
        RecurringObligation o = lock(userId, id);
        if (o.getStatus() == ObligationStatus.PAID) {
            throw new ApiException(HttpStatus.CONFLICT, "Este mes ya está pagado.");
        }
        if (o.getStatus() == ObligationStatus.SKIPPED) {
            throw new ApiException(HttpStatus.CONFLICT, "Este mes está omitido. Restauralo para pagarlo.");
        }
        return o;
    }

    /** Borra los meses posteriores a "after" que no estén pagados (eran solo una proyección). */
    private void deleteUnpaidAfter(Long recurringId, YearMonth after) {
        List<RecurringObligation> future = obligations.findByRecurringIdOrderByMonthDesc(recurringId).stream()
                .filter(o -> o.getMonth().isAfter(after) && o.getStatus() != ObligationStatus.PAID)
                .toList();
        obligations.deleteAll(future);
        obligations.flush();
    }

    private void apply(RecurringRequest request, RecurringExpense r) {
        r.setDescription(request.description().trim());
        r.setCategory(request.category());
        r.setAmount(request.amount());
        r.setDueDay(request.dueDay());
        r.setStartMonth(request.startMonth());
        r.setEndMonth(request.endMonth());
    }

    private void checkRange(RecurringRequest request, RecurringExpense existing) {
        YearMonth current = currentMonth();
        boolean startChanged = existing == null || !existing.getStartMonth().equals(request.startMonth());
        if (startChanged && request.startMonth().isBefore(current.minusMonths(MAX_MONTHS_BACK))) {
            throw ApiException.field(HttpStatus.BAD_REQUEST, "startMonth",
                    "El mes de inicio puede ser como máximo 12 meses atrás.");
        }
        if (request.startMonth().isAfter(current.plusMonths(MAX_MONTHS_AHEAD))) {
            throw ApiException.field(HttpStatus.BAD_REQUEST, "startMonth", "El mes de inicio está demasiado lejos.");
        }
        if (request.endMonth() != null && request.endMonth().isBefore(request.startMonth())) {
            throw ApiException.field(HttpStatus.BAD_REQUEST, "endMonth",
                    "El mes de fin no puede ser anterior al de inicio.");
        }
    }

    private RecurringResponse toResponse(RecurringExpense r, List<RecurringObligation> history) {
        YearMonth current = currentMonth();
        LocalDate today = LocalDate.now(clock);

        String state;
        if (r.getEndMonth() != null && r.getEndMonth().isBefore(current)) {
            state = "FINISHED";
        } else if (r.getStatus() == RecurringStatus.PAUSED) {
            state = "PAUSED";
        } else if (r.getStartMonth().isAfter(current)) {
            state = "SCHEDULED";
        } else {
            state = "ACTIVE";
        }

        LocalDate nextDue = history.stream()
                .filter(o -> o.getStatus() == ObligationStatus.PENDING && !o.getMonth().isBefore(current))
                .map(RecurringObligation::getDueDate)
                .min(Comparator.naturalOrder())
                .orElse(null);
        if (nextDue == null && (state.equals("ACTIVE") || state.equals("SCHEDULED"))) {
            YearMonth next = r.getStartMonth().isAfter(current) ? r.getStartMonth() : current.plusMonths(1);
            nextDue = r.includes(next) ? r.dueDateIn(next) : null;
        }
        int paid = (int) history.stream().filter(o -> o.getStatus() == ObligationStatus.PAID).count();
        int overdue = (int) history.stream()
                .filter(o -> o.getStatus() == ObligationStatus.PENDING && o.getDueDate().isBefore(today))
                .count();

        return new RecurringResponse(r.getId(), r.getDescription(), r.getCategory(), r.getAmount(), r.getDueDay(),
                r.getStartMonth(), r.getEndMonth(), r.getStatus(), state, nextDue, paid, overdue);
    }

    private List<ObligationResponse> toResponses(Long userId, List<RecurringObligation> list) {
        LocalDate today = LocalDate.now(clock);
        List<Long> expenseIds = list.stream().map(RecurringObligation::getExpenseId).filter(e -> e != null).toList();
        Map<Long, Expense> paidWith = expenses.findAllById(expenseIds).stream()
                .filter(e -> userId.equals(e.getUserId()))
                .collect(Collectors.toMap(Expense::getId, Function.identity()));
        return list.stream().map(o -> {
            Expense e = o.getExpenseId() != null ? paidWith.get(o.getExpenseId()) : null;
            return new ObligationResponse(o.getId(), o.getRecurringId(), o.getMonth(), o.getDueDate(),
                    o.getDescription(), o.getCategory(), o.getAmount(), o.isAmountAdjusted(), o.getStatus(),
                    o.getStatus() == ObligationStatus.PENDING && o.getDueDate().isBefore(today),
                    o.getExpenseId(), o.isExpenseCreated(),
                    e != null ? e.getAmount() : null, e != null ? e.getDate() : null);
        }).toList();
    }
}
