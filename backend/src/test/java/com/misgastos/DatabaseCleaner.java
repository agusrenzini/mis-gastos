package com.misgastos;

import com.misgastos.repository.AppUserRepository;
import com.misgastos.repository.BudgetItemRepository;
import com.misgastos.repository.ExpenseRepository;
import com.misgastos.repository.IncomeRepository;
import com.misgastos.repository.RecurringExpenseRepository;
import com.misgastos.repository.RecurringObligationRepository;
import org.springframework.stereotype.Component;

/** Vacía la base H2 de los tests respetando las claves foráneas. */
@Component
public class DatabaseCleaner {

    private final RecurringObligationRepository obligations;
    private final RecurringExpenseRepository recurrings;
    private final BudgetItemRepository budgets;
    private final IncomeRepository incomes;
    private final ExpenseRepository expenses;
    private final AppUserRepository users;

    public DatabaseCleaner(RecurringObligationRepository obligations, RecurringExpenseRepository recurrings,
                           BudgetItemRepository budgets, IncomeRepository incomes, ExpenseRepository expenses,
                           AppUserRepository users) {
        this.obligations = obligations;
        this.recurrings = recurrings;
        this.budgets = budgets;
        this.incomes = incomes;
        this.expenses = expenses;
        this.users = users;
    }

    public void clean() {
        obligations.deleteAllInBatch();
        recurrings.deleteAllInBatch();
        budgets.deleteAllInBatch();
        incomes.deleteAllInBatch();
        expenses.deleteAllInBatch();
        users.deleteAllInBatch();
    }
}
