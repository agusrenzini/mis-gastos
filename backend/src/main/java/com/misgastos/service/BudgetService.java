package com.misgastos.service;

import com.misgastos.dto.BudgetRequest;
import com.misgastos.dto.BudgetResponse;
import com.misgastos.dto.BudgetResponse.CategoryLine;
import com.misgastos.dto.BudgetResponse.Summary;
import com.misgastos.model.BudgetItem;
import com.misgastos.model.Category;
import com.misgastos.model.Expense;
import com.misgastos.model.Income;
import com.misgastos.model.IncomeStatus;
import com.misgastos.model.ObligationStatus;
import com.misgastos.model.RecurringObligation;
import com.misgastos.repository.BudgetItemRepository;
import com.misgastos.repository.ExpenseRepository;
import com.misgastos.repository.IncomeRepository;
import com.misgastos.repository.RecurringObligationRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Presupuesto mensual por categoría y resumen del mes.
 *
 * Por categoría: restante = presupuesto - gastos reales - fijos pendientes.
 * Un fijo pagado ya no está pendiente: su gasto real cuenta en "gastos reales", así que no se descuenta dos veces.
 * Ingresos planificados = recibidos + esperados: cada ingreso tiene un solo estado y cuenta una sola vez.
 * Asignar un presupuesto no registra gastos ni mueve dinero.
 */
@Service
public class BudgetService {

    private final BudgetItemRepository budgets;
    private final ExpenseRepository expenses;
    private final IncomeRepository incomes;
    private final RecurringObligationRepository obligations;
    private final RecurringService recurringService;

    public BudgetService(BudgetItemRepository budgets, ExpenseRepository expenses, IncomeRepository incomes,
                         RecurringObligationRepository obligations, RecurringService recurringService) {
        this.budgets = budgets;
        this.expenses = expenses;
        this.incomes = incomes;
        this.obligations = obligations;
        this.recurringService = recurringService;
    }

    @Transactional
    public BudgetResponse view(Long userId, YearMonth month) {
        recurringService.checkMonth(month);
        recurringService.ensureGenerated(userId, month);
        return calculate(month,
                budgets.findByUserIdAndMonth(userId, month),
                expenses.findByUserIdAndDateBetweenOrderByDateDescCreatedAtDesc(userId, month.atDay(1), month.atEndOfMonth()),
                incomes.findByUserIdAndDateBetweenOrderByDateDescCreatedAtDesc(userId, month.atDay(1), month.atEndOfMonth()),
                obligations.findByUserIdAndMonthOrderByDueDateAscDescriptionAsc(userId, month),
                budgets.existsByUserIdAndMonth(userId, month.minusMonths(1)));
    }

    /** Guarda el plan completo del mes. Las categorías en 0 o ausentes quedan sin presupuesto. */
    @Transactional
    public BudgetResponse save(Long userId, YearMonth month, BudgetRequest request) {
        recurringService.checkMonth(month);
        long distinct = request.items().stream().map(BudgetRequest.Item::category).distinct().count();
        if (distinct != request.items().size()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Cada categoría puede aparecer una sola vez.");
        }

        Map<Category, BudgetItem> existing = budgets.findByUserIdAndMonth(userId, month).stream()
                .collect(Collectors.toMap(BudgetItem::getCategory, Function.identity()));
        List<BudgetItem> toSave = new ArrayList<>();
        for (BudgetRequest.Item item : request.items()) {
            if (item.amount().signum() <= 0) {
                continue;
            }
            BudgetItem current = existing.remove(item.category());
            if (current == null) {
                current = new BudgetItem(userId, month, item.category(), item.amount());
            } else {
                current.setAmount(item.amount());
            }
            toSave.add(current);
        }
        budgets.deleteAll(existing.values());
        budgets.flush();
        budgets.saveAll(toSave);
        budgets.flush();
        return view(userId, month);
    }

    static BudgetResponse calculate(YearMonth month, List<BudgetItem> items, List<Expense> monthExpenses,
                                    List<Income> monthIncomes, List<RecurringObligation> monthObligations,
                                    boolean hasPreviousBudget) {
        Map<Category, BigDecimal> budget = new EnumMap<>(Category.class);
        items.forEach(i -> budget.put(i.getCategory(), i.getAmount()));

        Map<Category, BigDecimal> spent = new EnumMap<>(Category.class);
        monthExpenses.forEach(e -> spent.merge(e.getCategory(), e.getAmount(), BigDecimal::add));

        Map<Category, BigDecimal> pending = new EnumMap<>(Category.class);
        monthObligations.stream()
                .filter(o -> o.getStatus() == ObligationStatus.PENDING)
                .forEach(o -> pending.merge(o.getCategory(), o.getAmount(), BigDecimal::add));

        List<CategoryLine> lines = new ArrayList<>();
        for (Category category : Category.values()) {
            BigDecimal b = budget.getOrDefault(category, BigDecimal.ZERO);
            BigDecimal s = spent.getOrDefault(category, BigDecimal.ZERO);
            BigDecimal p = pending.getOrDefault(category, BigDecimal.ZERO);
            BigDecimal remaining = b.subtract(s).subtract(p);
            boolean assigned = budget.containsKey(category);
            lines.add(new CategoryLine(category, assigned, b, s, p, remaining, assigned && remaining.signum() < 0));
        }

        BigDecimal received = sumIncomes(monthIncomes, IncomeStatus.RECEIVED);
        BigDecimal expected = sumIncomes(monthIncomes, IncomeStatus.EXPECTED);
        BigDecimal planned = received.add(expected);
        BigDecimal expensesTotal = sum(spent);
        BigDecimal pendingTotal = sum(pending);
        BigDecimal budgetTotal = sum(budget);

        Summary summary = new Summary(
                received,
                expected,
                planned,
                expensesTotal,
                received.subtract(expensesTotal),
                pendingTotal,
                received.subtract(expensesTotal).subtract(pendingTotal),
                budgetTotal,
                planned.subtract(budgetTotal));

        return new BudgetResponse(month, summary, lines, !items.isEmpty(), hasPreviousBudget,
                budgetTotal.compareTo(planned) > 0);
    }

    private static BigDecimal sumIncomes(List<Income> list, IncomeStatus status) {
        return list.stream().filter(i -> i.getStatus() == status)
                .map(Income::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static BigDecimal sum(Map<Category, BigDecimal> values) {
        return values.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
