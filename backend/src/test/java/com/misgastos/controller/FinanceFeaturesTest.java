package com.misgastos.controller;

import com.jayway.jsonpath.JsonPath;
import com.misgastos.DatabaseCleaner;
import com.misgastos.model.AppUser;
import com.misgastos.model.ObligationStatus;
import com.misgastos.model.RecurringObligation;
import com.misgastos.repository.AppUserRepository;
import com.misgastos.repository.ExpenseRepository;
import com.misgastos.repository.IncomeRepository;
import com.misgastos.repository.RecurringObligationRepository;
import com.misgastos.security.AppUserPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Ingresos, gastos fijos y presupuesto. Usa un reloj de prueba (hoy = 15 de marzo de 2026, hora argentina)
 * que se puede adelantar para simular que pasan los meses, por ejemplo con el servidor suspendido.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(FinanceFeaturesTest.ClockConfig.class)
class FinanceFeaturesTest {

    static final ZoneId AR = ZoneId.of("America/Argentina/Buenos_Aires");
    static final LocalDate TODAY = LocalDate.of(2026, 3, 15);

    /** Reloj que los tests pueden mover. Reemplaza al de TimeConfig solo en esta clase. */
    static final class MutableClock extends Clock {
        private Instant now;

        void setDate(LocalDate date) {
            now = date.atTime(12, 0).atZone(AR).toInstant();
        }

        @Override public ZoneId getZone() { return AR; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }

    @TestConfiguration
    static class ClockConfig {
        @Bean
        @Primary
        MutableClock testClock() {
            MutableClock clock = new MutableClock();
            clock.setDate(TODAY);
            return clock;
        }
    }

    @Autowired private MockMvc mvc;
    @Autowired private DatabaseCleaner cleaner;
    @Autowired private AppUserRepository users;
    @Autowired private ExpenseRepository expenses;
    @Autowired private IncomeRepository incomes;
    @Autowired private RecurringObligationRepository obligations;
    @Autowired private MutableClock clock;
    @Autowired private JdbcTemplate jdbc;

    private AppUserPrincipal ana;
    private AppUserPrincipal beto;

    @BeforeEach
    void setUp() {
        clock.setDate(TODAY);
        cleaner.clean();
        ana = createUser("ana");
        beto = createUser("beto");
    }

    // ---------- Ayudas ----------

    private AppUserPrincipal createUser(String username) {
        AppUser user = new AppUser();
        user.setUsername(username);
        user.setPasswordHash("{noop}no-se-usa");
        return AppUserPrincipal.from(users.save(user));
    }

    private static RequestPostProcessor as(AppUserPrincipal principal) {
        return request -> csrf().postProcessRequest(user(principal).postProcessRequest(request));
    }

    private ResultActions call(AppUserPrincipal who, MockHttpServletRequestBuilder request, String json) throws Exception {
        if (json != null) {
            request.contentType(MediaType.APPLICATION_JSON).content(json);
        }
        return mvc.perform(request.with(as(who)));
    }

    private String body(ResultActions result) throws Exception {
        return result.andReturn().getResponse().getContentAsString();
    }

    private long id(ResultActions result) throws Exception {
        return ((Number) JsonPath.read(body(result), "$.id")).longValue();
    }

    private long createIncome(AppUserPrincipal who, String amount, String date, String status) throws Exception {
        return id(call(who, post("/api/incomes"), """
                {"description": "Sueldo", "amount": %s, "date": "%s", "type": "SUELDO", "status": "%s"}"""
                .formatted(amount, date, status)).andExpect(status().isCreated()));
    }

    private long createRecurring(AppUserPrincipal who, String description, String category, String amount,
                                 int dueDay, String start, String end) throws Exception {
        return id(call(who, post("/api/recurring"), """
                {"description": "%s", "category": "%s", "amount": %s, "dueDay": %d,
                 "startMonth": "%s", "endMonth": %s}"""
                .formatted(description, category, amount, dueDay, start, end == null ? "null" : "\"" + end + "\""))
                .andExpect(status().isCreated()));
    }

    private long createExpense(AppUserPrincipal who, String description, String category, String amount,
                               String date) throws Exception {
        return id(call(who, post("/api/expenses"), """
                {"amount": %s, "description": "%s", "date": "%s", "category": "%s", "paymentMethod": "DEBITO"}"""
                .formatted(amount, description, date, category)).andExpect(status().isCreated()));
    }

    /** Id de la obligación de un gasto fijo en un mes (la genera si falta). */
    private long obligationId(AppUserPrincipal who, long recurringId, String month) throws Exception {
        String json = body(call(who, get("/api/recurring/obligations").param("month", month), null)
                .andExpect(status().isOk()));
        List<Number> ids = JsonPath.read(json, "$[?(@.recurringId == " + recurringId + ")].id");
        assertThat(ids).as("obligación de %s", month).hasSize(1);
        return ids.getFirst().longValue();
    }

    private List<RecurringObligation> obligationsOf(long recurringId) {
        return obligations.findByRecurringIdOrderByMonthDesc(recurringId);
    }

    private String payJson(String amount, String date) {
        return """
                {"amount": %s, "date": "%s", "paymentMethod": "TRANSFERENCIA"}""".formatted(amount, date);
    }

    // ---------- Ingresos ----------

    @Test
    void expectedIncomeBecomesReceivedWithoutDuplicating() throws Exception {
        long id = createIncome(ana, "250000", "2026-03-30", "EXPECTED");

        call(ana, get("/api/budget").param("month", "2026-03"), null)
                .andExpect(jsonPath("$.summary.incomeReceived").value(0))
                .andExpect(jsonPath("$.summary.incomeExpectedPending").value(250000))
                .andExpect(jsonPath("$.summary.plannedIncome").value(250000));

        // Se cobra antes de lo esperado: el mismo registro pasa a recibido con fecha de hoy
        call(ana, post("/api/incomes/{id}/receive", id), null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.status").value("RECEIVED"))
                .andExpect(jsonPath("$.date").value("2026-03-15"));
        // Repetirlo no cambia nada
        call(ana, post("/api/incomes/{id}/receive", id), null).andExpect(jsonPath("$.status").value("RECEIVED"));

        assertThat(incomes.count()).isEqualTo(1);
        call(ana, get("/api/incomes").param("month", "2026-03"), null).andExpect(jsonPath("$", hasSize(1)));
        call(ana, get("/api/budget").param("month", "2026-03"), null)
                .andExpect(jsonPath("$.summary.incomeReceived").value(250000))
                .andExpect(jsonPath("$.summary.incomeExpectedPending").value(0))
                .andExpect(jsonPath("$.summary.plannedIncome").value(250000));
    }

    @Test
    void incomeCrudAndValidation() throws Exception {
        long id = createIncome(ana, "1000", "2026-03-01", "RECEIVED");
        call(ana, put("/api/incomes/{id}", id), """
                {"description": "Trabajo extra", "amount": 1500.50, "date": "2026-03-02", "type": "EXTRA", "status": "RECEIVED"}""")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.amount").value(1500.50))
                .andExpect(jsonPath("$.type").value("EXTRA"));
        call(ana, get("/api/incomes/{id}", id), null).andExpect(jsonPath("$.description").value("Trabajo extra"));

        // Recibido con fecha futura: no
        call(ana, post("/api/incomes"), """
                {"description": "X", "amount": 10, "date": "2026-03-20", "type": "OTROS", "status": "RECEIVED"}""")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.date").exists());
        // Importe no positivo y tipo inexistente
        call(ana, post("/api/incomes"), """
                {"description": "X", "amount": 0, "date": "2026-03-10", "type": "OTROS", "status": "EXPECTED"}""")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.amount").exists());
        call(ana, post("/api/incomes"), """
                {"description": "X", "amount": 5, "date": "2026-03-10", "type": "LOTERIA", "status": "EXPECTED"}""")
                .andExpect(status().isBadRequest());

        call(ana, delete("/api/incomes/{id}", id), null).andExpect(status().isNoContent());
        call(ana, get("/api/incomes/{id}", id), null).andExpect(status().isNotFound());
    }

    // ---------- Separación entre usuarios ----------

    @Test
    void usersCannotSeeOrTouchEachOthersData() throws Exception {
        long income = createIncome(ana, "1000", "2026-03-01", "EXPECTED");
        long recurring = createRecurring(ana, "Alquiler", "HOGAR", "1000", 10, "2026-03", null);
        long obligation = obligationId(ana, recurring, "2026-03");
        long anaExpense = createExpense(ana, "Super", "COMIDA", "500", "2026-03-02");
        call(ana, put("/api/budget").param("month", "2026-03"), """
                {"items": [{"category": "COMIDA", "amount": 9000}]}""").andExpect(status().isOk());

        // Ingresos de ana por id
        call(beto, get("/api/incomes/{id}", income), null).andExpect(status().isNotFound());
        call(beto, put("/api/incomes/{id}", income), """
                {"description": "X", "amount": 1, "date": "2026-03-01", "type": "OTROS", "status": "RECEIVED"}""")
                .andExpect(status().isNotFound());
        call(beto, post("/api/incomes/{id}/receive", income), null).andExpect(status().isNotFound());
        call(beto, delete("/api/incomes/{id}", income), null).andExpect(status().isNotFound());
        call(beto, get("/api/incomes").param("month", "2026-03"), null).andExpect(jsonPath("$", hasSize(0)));

        // Gastos fijos y obligaciones de ana por id
        call(beto, get("/api/recurring/{id}", recurring), null).andExpect(status().isNotFound());
        call(beto, put("/api/recurring/{id}", recurring), """
                {"description": "X", "category": "OTROS", "amount": 1, "dueDay": 1, "startMonth": "2026-03"}""")
                .andExpect(status().isNotFound());
        call(beto, post("/api/recurring/{id}/pause", recurring), null).andExpect(status().isNotFound());
        call(beto, post("/api/recurring/{id}/finish", recurring), null).andExpect(status().isNotFound());
        call(beto, delete("/api/recurring/{id}", recurring), null).andExpect(status().isNotFound());
        call(beto, get("/api/recurring/obligations/{id}", obligation), null).andExpect(status().isNotFound());
        call(beto, post("/api/recurring/obligations/{id}/pay", obligation), payJson("1000", "2026-03-10"))
                .andExpect(status().isNotFound());
        call(beto, post("/api/recurring/obligations/{id}/link", obligation), "{\"expenseId\": " + anaExpense + "}")
                .andExpect(status().isNotFound());
        call(beto, get("/api/recurring/obligations/{id}/candidates", obligation), null).andExpect(status().isNotFound());
        call(beto, put("/api/recurring/obligations/{id}/amount", obligation), "{\"amount\": 1}")
                .andExpect(status().isNotFound());
        call(beto, post("/api/recurring/obligations/{id}/skip", obligation), null).andExpect(status().isNotFound());
        call(beto, get("/api/recurring"), null).andExpect(jsonPath("$", hasSize(0)));
        call(beto, get("/api/recurring/obligations").param("month", "2026-03"), null).andExpect(jsonPath("$", hasSize(0)));

        // Beto no puede pagar su propio fijo vinculando un gasto de ana
        long betoRecurring = createRecurring(beto, "Gimnasio", "SALUD", "300", 5, "2026-03", null);
        long betoObligation = obligationId(beto, betoRecurring, "2026-03");
        call(beto, post("/api/recurring/obligations/{id}/link", betoObligation), "{\"expenseId\": " + anaExpense + "}")
                .andExpect(status().isNotFound());

        // El resumen y el presupuesto de beto no incluyen nada de ana
        call(beto, get("/api/budget").param("month", "2026-03"), null)
                .andExpect(jsonPath("$.summary.plannedIncome").value(0))
                .andExpect(jsonPath("$.summary.expenses").value(0))
                .andExpect(jsonPath("$.summary.pendingRecurring").value(300))
                .andExpect(jsonPath("$.summary.budgetTotal").value(0))
                .andExpect(jsonPath("$.hasBudget").value(false));

        // Los datos de ana siguen intactos
        call(ana, get("/api/recurring/obligations/{id}", obligation), null)
                .andExpect(jsonPath("$.status").value("PENDING"));
        call(ana, get("/api/budget").param("month", "2026-03"), null)
                .andExpect(jsonPath("$.summary.budgetTotal").value(9000))
                .andExpect(jsonPath("$.summary.expenses").value(500))
                .andExpect(jsonPath("$.summary.plannedIncome").value(1000));
    }

    // ---------- Generación de obligaciones ----------

    @Test
    void endOfMonthDueDatesUseTheLastDay() throws Exception {
        long recurring = createRecurring(ana, "Alquiler", "HOGAR", "1000", 31, "2026-01", null);
        call(ana, get("/api/recurring/obligations/{id}", obligationId(ana, recurring, "2026-01")), null)
                .andExpect(jsonPath("$.dueDate").value("2026-01-31"));
        call(ana, get("/api/recurring/obligations/{id}", obligationId(ana, recurring, "2026-02")), null)
                .andExpect(jsonPath("$.dueDate").value("2026-02-28"));
        call(ana, get("/api/recurring/obligations/{id}", obligationId(ana, recurring, "2026-04")), null)
                .andExpect(jsonPath("$.dueDate").value("2026-04-30"));

        long leap = createRecurring(ana, "Seguro", "OTROS", "500", 30, "2026-03", null);
        call(ana, get("/api/recurring/obligations/{id}", obligationId(ana, leap, "2028-02")), null)
                .andExpect(jsonPath("$.dueDate").value("2028-02-29"));
    }

    @Test
    void generationIsIdempotentAndProtectedByTheDatabase() throws Exception {
        long recurring = createRecurring(ana, "Alquiler", "HOGAR", "1000", 10, "2026-01", null);

        for (int i = 0; i < 3; i++) {
            call(ana, get("/api/recurring/obligations").param("month", "2026-03"), null).andExpect(status().isOk());
            call(ana, get("/api/budget").param("month", "2026-03"), null).andExpect(status().isOk());
            call(ana, get("/api/recurring"), null).andExpect(status().isOk());
        }
        // Enero, febrero y marzo: una sola vez cada uno
        assertThat(obligationsOf(recurring)).extracting(RecurringObligation::getMonth)
                .containsExactly(YearMonth.of(2026, 3), YearMonth.of(2026, 2), YearMonth.of(2026, 1));

        // La base rechaza una segunda obligación del mismo gasto fijo y mes
        assertThatThrownBy(() -> jdbc.update("""
                INSERT INTO recurring_obligation (user_id, recurring_id, obligation_month, due_date, description,
                    category, amount, status, created_at, updated_at)
                VALUES (?, ?, DATE '2026-03-01', DATE '2026-03-10', 'Copia', 'HOGAR', 1000, 'PENDING',
                    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)""", ana.id(), recurring))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void missingMonthsAreGeneratedAfterTheServerWasAsleep() throws Exception {
        long recurring = createRecurring(ana, "Alquiler", "HOGAR", "1000", 10, "2026-03", null);
        assertThat(obligationsOf(recurring)).hasSize(1);

        // Pasan tres meses sin que nadie use la app (Render suspendido): no corre ningún proceso
        clock.setDate(LocalDate.of(2026, 6, 20));
        assertThat(obligationsOf(recurring)).hasSize(1);

        // Al volver a abrir la app se completan los meses que faltan, sin duplicar
        call(ana, get("/api/recurring"), null)
                .andExpect(jsonPath("$[0].overdueCount").value(4))
                .andExpect(jsonPath("$[0].state").value("ACTIVE"));
        call(ana, get("/api/recurring"), null).andExpect(status().isOk());
        assertThat(obligationsOf(recurring)).extracting(RecurringObligation::getMonth)
                .containsExactly(YearMonth.of(2026, 6), YearMonth.of(2026, 5), YearMonth.of(2026, 4), YearMonth.of(2026, 3));
    }

    // ---------- Pagar y vincular ----------

    @Test
    void payingCreatesOneRealExpenseAndCannotBeRepeated() throws Exception {
        long recurring = createRecurring(ana, "Alquiler", "HOGAR", "1000", 10, "2026-03", null);
        long obligation = obligationId(ana, recurring, "2026-03");

        call(ana, get("/api/budget").param("month", "2026-03"), null)
                .andExpect(jsonPath("$.summary.pendingRecurring").value(1000))
                .andExpect(jsonPath("$.summary.expenses").value(0));

        // La factura vino más cara: se paga 1200
        call(ana, post("/api/recurring/obligations/{id}/pay", obligation), payJson("1200", "2026-03-10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PAID"))
                .andExpect(jsonPath("$.amount").value(1200))
                .andExpect(jsonPath("$.amountAdjusted").value(true))
                .andExpect(jsonPath("$.expenseCreated").value(true))
                .andExpect(jsonPath("$.paidAmount").value(1200))
                .andExpect(jsonPath("$.paidDate").value("2026-03-10"));

        // Un único gasto real, con los datos del fijo
        call(ana, get("/api/expenses"), null)
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].description").value("Alquiler"))
                .andExpect(jsonPath("$[0].category").value("HOGAR"))
                .andExpect(jsonPath("$[0].amount").value(1200))
                .andExpect(jsonPath("$[0].paymentMethod").value("TRANSFERENCIA"));

        // Pasa de pendiente a gasto real: no se descuenta dos veces
        call(ana, get("/api/budget").param("month", "2026-03"), null)
                .andExpect(jsonPath("$.summary.pendingRecurring").value(0))
                .andExpect(jsonPath("$.summary.expenses").value(1200));

        // No se puede pagar ni vincular de nuevo
        call(ana, post("/api/recurring/obligations/{id}/pay", obligation), payJson("1200", "2026-03-11"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Este mes ya está pagado."));
        long other = createExpense(ana, "Otro", "HOGAR", "50", "2026-03-11");
        call(ana, post("/api/recurring/obligations/{id}/link", obligation), "{\"expenseId\": " + other + "}")
                .andExpect(status().isConflict());
        assertThat(expenses.count()).isEqualTo(2);

        // Deshacer: vuelve a pendiente y el gasto que creó la app se elimina
        call(ana, post("/api/recurring/obligations/{id}/unpay", obligation), null)
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.expenseId").isEmpty());
        assertThat(expenses.count()).isEqualTo(1);
        call(ana, get("/api/budget").param("month", "2026-03"), null)
                .andExpect(jsonPath("$.summary.pendingRecurring").value(1200))
                .andExpect(jsonPath("$.summary.expenses").value(50));
    }

    @Test
    void linkingAnExistingExpenseAvoidsDuplicates() throws Exception {
        long luz = createRecurring(ana, "Luz", "HOGAR", "7000", 10, "2026-03", null);
        long alquiler = createRecurring(ana, "Alquiler", "HOGAR", "1000", 5, "2026-03", null);
        long luzMarch = obligationId(ana, luz, "2026-03");
        long alquilerMarch = obligationId(ana, alquiler, "2026-03");
        long loaded = createExpense(ana, "Factura luz", "HOGAR", "8000", "2026-03-08");

        call(ana, get("/api/recurring/obligations/{id}/candidates", luzMarch), null)
                .andExpect(jsonPath("$[0].id").value(loaded));

        call(ana, post("/api/recurring/obligations/{id}/link", luzMarch), "{\"expenseId\": " + loaded + "}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PAID"))
                .andExpect(jsonPath("$.expenseCreated").value(false))
                .andExpect(jsonPath("$.paidAmount").value(8000));
        assertThat(expenses.count()).isEqualTo(1);

        // El presupuesto cuenta 8000 reales + 1000 pendientes del alquiler; la luz ya no está pendiente
        call(ana, get("/api/budget").param("month", "2026-03"), null)
                .andExpect(jsonPath("$.summary.expenses").value(8000))
                .andExpect(jsonPath("$.summary.pendingRecurring").value(1000));

        // El mismo gasto no puede pagar otra obligación (ni aparece como candidato)
        call(ana, post("/api/recurring/obligations/{id}/link", alquilerMarch), "{\"expenseId\": " + loaded + "}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Ese gasto ya está vinculado a otro gasto fijo."));
        call(ana, get("/api/recurring/obligations/{id}/candidates", alquilerMarch), null)
                .andExpect(jsonPath("$", hasSize(0)));

        // Deshacer un vínculo no borra el gasto que ya existía
        call(ana, post("/api/recurring/obligations/{id}/unpay", luzMarch), null)
                .andExpect(jsonPath("$.status").value("PENDING"));
        assertThat(expenses.count()).isEqualTo(1);

        // Si se elimina el gasto con el que se pagó, el mes vuelve a quedar pendiente
        call(ana, post("/api/recurring/obligations/{id}/link", luzMarch), "{\"expenseId\": " + loaded + "}")
                .andExpect(status().isOk());
        call(ana, delete("/api/expenses/{id}", loaded), null).andExpect(status().isNoContent());
        call(ana, get("/api/recurring/obligations/{id}", luzMarch), null)
                .andExpect(jsonPath("$.status").value("PENDING"));
    }

    @Test
    void theDatabaseRejectsInconsistentPayments() throws Exception {
        long recurring = createRecurring(ana, "Alquiler", "HOGAR", "1000", 10, "2026-02", null);
        long feb = obligationId(ana, recurring, "2026-02");
        long march = obligationId(ana, recurring, "2026-03");
        long expense = createExpense(ana, "Alquiler", "HOGAR", "1000", "2026-02-10");

        // Pagada sin gasto
        assertThatThrownBy(() -> jdbc.update("UPDATE recurring_obligation SET status = 'PAID' WHERE id = ?", feb))
                .isInstanceOf(DataIntegrityViolationException.class);
        // El mismo gasto en dos obligaciones
        jdbc.update("UPDATE recurring_obligation SET status = 'PAID', expense_id = ? WHERE id = ?", expense, feb);
        assertThatThrownBy(() -> jdbc.update(
                "UPDATE recurring_obligation SET status = 'PAID', expense_id = ? WHERE id = ?", expense, march))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    // ---------- Ajustar, editar, pausar, finalizar ----------

    @Test
    void editingTheConfigurationKeepsPaidAndPastMonths() throws Exception {
        long recurring = createRecurring(ana, "Internet", "SUSCRIPCIONES", "5000", 15, "2026-01", null);
        long jan = obligationId(ana, recurring, "2026-01");
        long feb = obligationId(ana, recurring, "2026-02");
        long march = obligationId(ana, recurring, "2026-03");
        long april = obligationId(ana, recurring, "2026-04");

        call(ana, post("/api/recurring/obligations/{id}/pay", jan), payJson("5000", "2026-01-15")).andExpect(status().isOk());
        call(ana, put("/api/recurring/obligations/{id}/amount", march), "{\"amount\": 5500}")
                .andExpect(jsonPath("$.amount").value(5500))
                .andExpect(jsonPath("$.amountAdjusted").value(true));

        call(ana, put("/api/recurring/{id}", recurring), """
                {"description": "Internet fibra", "category": "TECNOLOGIA", "amount": 6000, "dueDay": 20,
                 "startMonth": "2026-01"}""").andExpect(status().isOk());

        // Enero (pagado) y febrero (mes pasado) quedan como estaban
        call(ana, get("/api/recurring/obligations/{id}", jan), null)
                .andExpect(jsonPath("$.description").value("Internet"))
                .andExpect(jsonPath("$.amount").value(5000))
                .andExpect(jsonPath("$.status").value("PAID"));
        call(ana, get("/api/recurring/obligations/{id}", feb), null)
                .andExpect(jsonPath("$.amount").value(5000))
                .andExpect(jsonPath("$.dueDate").value("2026-02-15"));
        // Marzo (mes actual, ajustado a mano): toma los datos nuevos pero conserva su importe
        call(ana, get("/api/recurring/obligations/{id}", march), null)
                .andExpect(jsonPath("$.description").value("Internet fibra"))
                .andExpect(jsonPath("$.category").value("TECNOLOGIA"))
                .andExpect(jsonPath("$.amount").value(5500))
                .andExpect(jsonPath("$.dueDate").value("2026-03-20"));
        // Abril: todo nuevo
        call(ana, get("/api/recurring/obligations/{id}", april), null)
                .andExpect(jsonPath("$.amount").value(6000));
        // El gasto real de enero no cambió
        call(ana, get("/api/expenses"), null).andExpect(jsonPath("$[0].description").value("Internet"));

        // Ajustar un mes pagado no se puede
        call(ana, put("/api/recurring/obligations/{id}/amount", jan), "{\"amount\": 1}")
                .andExpect(status().isConflict());
    }

    @Test
    void pauseResumeAndFinishKeepHistory() throws Exception {
        long gym = createRecurring(ana, "Gimnasio", "SALUD", "3000", 5, "2026-02", null);
        long feb = obligationId(ana, gym, "2026-02");
        call(ana, post("/api/recurring/obligations/{id}/pay", feb), payJson("3000", "2026-02-05")).andExpect(status().isOk());
        obligationId(ana, gym, "2026-05"); // proyecta abril y mayo
        assertThat(obligationsOf(gym)).hasSize(4);

        // Pausar: se van abril y mayo (proyección); febrero (pagado) y marzo (mes actual) quedan
        call(ana, post("/api/recurring/{id}/pause", gym), null)
                .andExpect(jsonPath("$.state").value("PAUSED"));
        assertThat(obligationsOf(gym)).extracting(RecurringObligation::getMonth)
                .containsExactly(YearMonth.of(2026, 3), YearMonth.of(2026, 2));
        call(ana, get("/api/recurring/obligations").param("month", "2026-05"), null).andExpect(jsonPath("$", hasSize(0)));

        // Pausado durante abril y mayo; se reanuda en junio: esos meses no se generan
        clock.setDate(LocalDate.of(2026, 6, 1));
        call(ana, get("/api/recurring"), null).andExpect(status().isOk());
        assertThat(obligationsOf(gym)).hasSize(2);
        call(ana, post("/api/recurring/{id}/resume", gym), null).andExpect(jsonPath("$.state").value("ACTIVE"));
        assertThat(obligationsOf(gym)).extracting(RecurringObligation::getMonth)
                .containsExactly(YearMonth.of(2026, 6), YearMonth.of(2026, 3), YearMonth.of(2026, 2));

        // Finalizar: termina en junio; no se generan meses posteriores
        call(ana, post("/api/recurring/{id}/finish", gym), null)
                .andExpect(jsonPath("$.endMonth").value("2026-06"));
        call(ana, get("/api/recurring/obligations").param("month", "2026-08"), null).andExpect(jsonPath("$", hasSize(0)));
        clock.setDate(LocalDate.of(2026, 7, 10));
        call(ana, get("/api/recurring"), null).andExpect(jsonPath("$[0].state").value("FINISHED"));
        assertThat(obligationsOf(gym)).hasSize(3);

        // Con meses pagados no se puede eliminar (hay que finalizarlo)
        call(ana, delete("/api/recurring/{id}", gym), null).andExpect(status().isConflict());
        assertThat(obligations.findById(feb)).get()
                .extracting(RecurringObligation::getStatus).isEqualTo(ObligationStatus.PAID);

        // Uno sin pagos sí se elimina, junto con sus meses pendientes
        long unused = createRecurring(ana, "Revista", "OTROS", "100", 1, "2026-07", null);
        call(ana, delete("/api/recurring/{id}", unused), null).andExpect(status().isNoContent());
        assertThat(obligationsOf(unused)).isEmpty();
    }

    @Test
    void skippedMonthsAreNotPending() throws Exception {
        long recurring = createRecurring(ana, "Alquiler", "HOGAR", "1000", 10, "2026-03", null);
        long march = obligationId(ana, recurring, "2026-03");

        call(ana, post("/api/recurring/obligations/{id}/skip", march), null).andExpect(jsonPath("$.status").value("SKIPPED"));
        call(ana, get("/api/budget").param("month", "2026-03"), null)
                .andExpect(jsonPath("$.summary.pendingRecurring").value(0));
        call(ana, post("/api/recurring/obligations/{id}/pay", march), payJson("1000", "2026-03-10"))
                .andExpect(status().isConflict());

        call(ana, post("/api/recurring/obligations/{id}/restore", march), null).andExpect(jsonPath("$.status").value("PENDING"));
        call(ana, get("/api/budget").param("month", "2026-03"), null)
                .andExpect(jsonPath("$.summary.pendingRecurring").value(1000));
    }

    @Test
    void recurringValidation() throws Exception {
        call(ana, post("/api/recurring"), """
                {"description": "X", "category": "OTROS", "amount": 10, "dueDay": 32, "startMonth": "2026-03"}""")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.dueDay").exists());
        call(ana, post("/api/recurring"), """
                {"description": "X", "category": "OTROS", "amount": 10, "dueDay": 1, "startMonth": "2026-05", "endMonth": "2026-04"}""")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.endMonth").exists());
        call(ana, post("/api/recurring"), """
                {"description": "X", "category": "OTROS", "amount": 10, "dueDay": 1, "startMonth": "2024-01"}""")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.startMonth").exists());
    }

    // ---------- Presupuesto y resumen ----------

    @Test
    void budgetCalculatesRemainingAndWarnings() throws Exception {
        call(ana, put("/api/budget").param("month", "2026-03"), """
                {"items": [{"category": "COMIDA", "amount": 10000}, {"category": "HOGAR", "amount": 5000},
                           {"category": "OTROS", "amount": 0}]}""")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasBudget").value(true));

        createExpense(ana, "Super", "COMIDA", "4000", "2026-03-02");
        createExpense(ana, "Verdulería", "COMIDA", "3000", "2026-03-03");
        createExpense(ana, "Cine", "ENTRETENIMIENTO", "2000", "2026-03-04");
        createExpense(ana, "Febrero", "COMIDA", "9999", "2026-02-28"); // otro mes: no cuenta
        long vianda = createRecurring(ana, "Vianda", "COMIDA", "4000", 20, "2026-03", null);
        createIncome(ana, "8000", "2026-03-05", "RECEIVED");
        createIncome(ana, "5000", "2026-03-28", "EXPECTED");

        String json = body(call(ana, get("/api/budget").param("month", "2026-03"), null).andExpect(status().isOk()));
        // Comida: 10000 - 7000 reales - 4000 pendientes = -1000 → excedida
        assertThat(line(json, "COMIDA", "budget")).isEqualByComparingTo("10000");
        assertThat(line(json, "COMIDA", "spent")).isEqualByComparingTo("7000");
        assertThat(line(json, "COMIDA", "pendingRecurring")).isEqualByComparingTo("4000");
        assertThat(line(json, "COMIDA", "remaining")).isEqualByComparingTo("-1000");
        assertThat(flag(json, "COMIDA", "exceeded")).isTrue();
        // Hogar: sin gastos, sobra todo
        assertThat(line(json, "HOGAR", "remaining")).isEqualByComparingTo("5000");
        // Entretenimiento: sin presupuesto (no se marca como excedida, pero el restante es negativo)
        assertThat(flag(json, "ENTRETENIMIENTO", "assigned")).isFalse();
        assertThat(line(json, "ENTRETENIMIENTO", "remaining")).isEqualByComparingTo("-2000");
        // Otros en 0 = sin presupuesto
        assertThat(flag(json, "OTROS", "assigned")).isFalse();

        // Resumen del mes
        call(ana, get("/api/budget").param("month", "2026-03"), null)
                .andExpect(jsonPath("$.summary.incomeReceived").value(8000))
                .andExpect(jsonPath("$.summary.incomeExpectedPending").value(5000))
                .andExpect(jsonPath("$.summary.plannedIncome").value(13000))
                .andExpect(jsonPath("$.summary.expenses").value(9000))
                .andExpect(jsonPath("$.summary.registeredBalance").value(-1000))
                .andExpect(jsonPath("$.summary.pendingRecurring").value(4000))
                .andExpect(jsonPath("$.summary.balanceAfterPending").value(-5000))
                .andExpect(jsonPath("$.summary.budgetTotal").value(15000))
                .andExpect(jsonPath("$.summary.unassignedPlannedIncome").value(-2000))
                .andExpect(jsonPath("$.overPlanned").value(true));

        // Pagar la vianda: pasa de pendiente a real, el restante de Comida no cambia
        call(ana, post("/api/recurring/obligations/{id}/pay", obligationId(ana, vianda, "2026-03")),
                payJson("4000", "2026-03-15")).andExpect(status().isOk());
        String after = body(call(ana, get("/api/budget").param("month", "2026-03"), null));
        assertThat(line(after, "COMIDA", "spent")).isEqualByComparingTo("11000");
        assertThat(line(after, "COMIDA", "pendingRecurring")).isEqualByComparingTo("0");
        assertThat(line(after, "COMIDA", "remaining")).isEqualByComparingTo("-1000");
        assertThat(new BigDecimal(JsonPath.read(after, "$.summary.balanceAfterPending").toString()))
                .isEqualByComparingTo("-5000");
    }

    private static boolean flag(String json, String category, String field) {
        List<Boolean> values = JsonPath.read(json, "$.categories[?(@.category == '" + category + "')]." + field);
        return values.getFirst();
    }

    private static BigDecimal line(String json, String category, String field) {
        List<Object> values = JsonPath.read(json, "$.categories[?(@.category == '" + category + "')]." + field);
        return new BigDecimal(values.getFirst().toString());
    }

    @Test
    void budgetCanBeCopiedFromThePreviousMonthAndEdited() throws Exception {
        call(ana, put("/api/budget").param("month", "2026-03"), """
                {"items": [{"category": "COMIDA", "amount": 10000}, {"category": "HOGAR", "amount": 5000}]}""");

        call(ana, get("/api/budget").param("month", "2026-04"), null)
                .andExpect(jsonPath("$.hasBudget").value(false))
                .andExpect(jsonPath("$.hasPreviousBudget").value(true));

        // El frontend toma el de marzo, el usuario edita y guarda abril
        call(ana, put("/api/budget").param("month", "2026-04"), """
                {"items": [{"category": "COMIDA", "amount": 12000}]}""")
                .andExpect(jsonPath("$.summary.budgetTotal").value(12000));
        // Marzo no cambió
        call(ana, get("/api/budget").param("month", "2026-03"), null)
                .andExpect(jsonPath("$.summary.budgetTotal").value(15000));
        // Guardar de nuevo reemplaza el plan del mes
        call(ana, put("/api/budget").param("month", "2026-03"), """
                {"items": [{"category": "HOGAR", "amount": 6000}]}""")
                .andExpect(jsonPath("$.summary.budgetTotal").value(6000));

        // Sin ingresos planificados, avisa pero guarda igual
        call(ana, get("/api/budget").param("month", "2026-03"), null).andExpect(jsonPath("$.overPlanned").value(true));

        call(ana, put("/api/budget").param("month", "2026-03"), """
                {"items": [{"category": "HOGAR", "amount": 1}, {"category": "HOGAR", "amount": 2}]}""")
                .andExpect(status().isBadRequest());
        call(ana, put("/api/budget").param("month", "2026-03"), """
                {"items": [{"category": "HOGAR", "amount": -5}]}""")
                .andExpect(status().isBadRequest());
        call(ana, put("/api/budget"), "{\"items\": []}").andExpect(status().isBadRequest());
        call(ana, get("/api/budget").param("month", "2040-01"), null).andExpect(status().isBadRequest());
    }
}
