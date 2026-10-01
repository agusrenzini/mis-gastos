package com.misgastos.service;

import com.misgastos.dto.ExpenseRequest;
import com.misgastos.dto.ExpenseResponse;
import com.misgastos.model.Expense;
import com.misgastos.model.ExpenseSource;
import com.misgastos.repository.ExpenseRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
public class ExpenseService {

    private static final LocalDate MIN_DATE = LocalDate.of(1970, 1, 1);
    private static final LocalDate MAX_DATE = LocalDate.of(9999, 12, 31);

    private final ExpenseRepository repository;

    public ExpenseService(ExpenseRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public ExpenseResponse create(Long userId, ExpenseRequest request) {
        Expense expense = new Expense();
        expense.setUserId(userId);
        apply(request, expense);
        return ExpenseResponse.from(repository.save(expense));
    }

    /** Sin fechas devuelve todos los gastos; con una o ambas, filtra por ese rango. */
    @Transactional(readOnly = true)
    public List<ExpenseResponse> list(Long userId, LocalDate from, LocalDate to) {
        List<Expense> expenses = (from == null && to == null)
                ? repository.findByUserIdOrderByDateDescCreatedAtDesc(userId)
                : repository.findByUserIdAndDateBetweenOrderByDateDescCreatedAtDesc(userId,
                        from != null ? from : MIN_DATE,
                        to != null ? to : MAX_DATE);
        return expenses.stream().map(ExpenseResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public ExpenseResponse get(Long userId, Long id) {
        return ExpenseResponse.from(find(userId, id));
    }

    @Transactional
    public ExpenseResponse update(Long userId, Long id, ExpenseRequest request) {
        Expense expense = find(userId, id);
        apply(request, expense);
        return ExpenseResponse.from(repository.saveAndFlush(expense));
    }

    @Transactional
    public void delete(Long userId, Long id) {
        repository.delete(find(userId, id));
    }

    /** Un gasto de otro usuario responde igual que uno inexistente (404): no se revela que existe. */
    private Expense find(Long userId, Long id) {
        return repository.findByIdAndUserId(id, userId).orElseThrow(() -> new ExpenseNotFoundException(id));
    }

    private void apply(ExpenseRequest request, Expense expense) {
        expense.setAmount(request.amount());
        expense.setDescription(request.description().trim());
        expense.setDate(request.date());
        expense.setCategory(request.category());
        expense.setPaymentMethod(request.paymentMethod());
        expense.setSource(request.source() != null ? request.source() : ExpenseSource.MANUAL);
        String transcript = request.voiceTranscript();
        expense.setVoiceTranscript(transcript == null || transcript.isBlank() ? null : transcript.trim());
    }
}
