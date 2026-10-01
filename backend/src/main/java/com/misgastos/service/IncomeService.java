package com.misgastos.service;

import com.misgastos.dto.IncomeRequest;
import com.misgastos.dto.IncomeResponse;
import com.misgastos.model.Income;
import com.misgastos.model.IncomeStatus;
import com.misgastos.repository.IncomeRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

/** Ingresos del usuario. Todas las operaciones verifican que el ingreso le pertenezca. */
@Service
public class IncomeService {

    private static final LocalDate MIN_DATE = LocalDate.of(2000, 1, 1);

    private final IncomeRepository repository;
    private final Clock clock;

    public IncomeService(IncomeRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    @Transactional
    public IncomeResponse create(Long userId, IncomeRequest request) {
        Income income = new Income();
        income.setUserId(userId);
        apply(request, income);
        return IncomeResponse.from(repository.save(income));
    }

    @Transactional(readOnly = true)
    public List<IncomeResponse> list(Long userId, YearMonth month) {
        return repository.findByUserIdAndDateBetweenOrderByDateDescCreatedAtDesc(
                        userId, month.atDay(1), month.atEndOfMonth())
                .stream().map(IncomeResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public IncomeResponse get(Long userId, Long id) {
        return IncomeResponse.from(find(userId, id));
    }

    @Transactional
    public IncomeResponse update(Long userId, Long id, IncomeRequest request) {
        Income income = find(userId, id);
        apply(request, income);
        return IncomeResponse.from(repository.saveAndFlush(income));
    }

    @Transactional
    public void delete(Long userId, Long id) {
        repository.delete(find(userId, id));
    }

    /**
     * Marca un ingreso esperado como recibido. Cambia el mismo registro: el importe no se duplica.
     * Si ya estaba recibido no hace nada. Sin fecha usa la esperada, o hoy si la esperada es futura.
     */
    @Transactional
    public IncomeResponse receive(Long userId, Long id, LocalDate date) {
        Income income = find(userId, id);
        if (income.getStatus() == IncomeStatus.RECEIVED) {
            return IncomeResponse.from(income);
        }
        LocalDate today = LocalDate.now(clock);
        LocalDate received = date != null ? date : (income.getDate().isAfter(today) ? today : income.getDate());
        checkDate(received, IncomeStatus.RECEIVED);
        income.setDate(received);
        income.setStatus(IncomeStatus.RECEIVED);
        return IncomeResponse.from(repository.saveAndFlush(income));
    }

    private Income find(Long userId, Long id) {
        return repository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "El ingreso no existe o ya fue eliminado."));
    }

    private void apply(IncomeRequest request, Income income) {
        checkDate(request.date(), request.status());
        income.setDescription(request.description().trim());
        income.setAmount(request.amount());
        income.setDate(request.date());
        income.setType(request.type());
        income.setStatus(request.status());
    }

    /** Un ingreso esperado puede tener fecha futura; uno recibido no. */
    private void checkDate(LocalDate date, IncomeStatus status) {
        LocalDate today = LocalDate.now(clock);
        if (date.isBefore(MIN_DATE) || date.isAfter(today.plusYears(2))) {
            throw ApiException.field(HttpStatus.BAD_REQUEST, "date", "La fecha no es válida.");
        }
        if (status == IncomeStatus.RECEIVED && date.isAfter(today)) {
            throw ApiException.field(HttpStatus.BAD_REQUEST, "date",
                    "Un ingreso recibido no puede tener fecha futura. Si todavía no lo cobraste, marcalo como esperado.");
        }
    }
}
