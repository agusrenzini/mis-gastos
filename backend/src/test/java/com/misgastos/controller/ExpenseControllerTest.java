package com.misgastos.controller;

import com.misgastos.repository.ExpenseRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Prueba la API completa (controlador + servicio + base H2). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ExpenseControllerTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ExpenseRepository repository;

    @BeforeEach
    void cleanDatabase() {
        repository.deleteAll();
    }

    private String json(String amount, String description, String date, String category) {
        return """
                {"amount": %s, "description": "%s", "date": "%s",
                 "category": "%s", "paymentMethod": "DEBITO"}
                """.formatted(amount, description, date, category);
    }

    private long create(String amount, String description, String date, String category) throws Exception {
        String body = mvc.perform(post("/api/expenses")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(amount, description, date, category)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return Long.parseLong(body.replaceAll(".*\"id\":(\\d+).*", "$1"));
    }

    @Test
    void createsAnExpense() throws Exception {
        mvc.perform(post("/api/expenses")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json("18000.50", "Cena", "2026-09-25", "COMIDA")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.amount").value(18000.50))
                .andExpect(jsonPath("$.description").value("Cena"))
                .andExpect(jsonPath("$.date").value("2026-09-25"))
                .andExpect(jsonPath("$.category").value("COMIDA"))
                .andExpect(jsonPath("$.source").value("MANUAL"))
                .andExpect(jsonPath("$.createdAt").isNotEmpty());
    }

    @Test
    void savesVoiceTranscript() throws Exception {
        mvc.perform(post("/api/expenses")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"amount": 4500, "description": "Nafta", "date": "2026-09-20",
                                 "category": "TRANSPORTE", "paymentMethod": "EFECTIVO",
                                 "source": "VOICE", "voiceTranscript": "Gasté 4500 en nafta"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.source").value("VOICE"))
                .andExpect(jsonPath("$.voiceTranscript").value("Gasté 4500 en nafta"));
    }

    @Test
    void rejectsInvalidExpenseWithReadableErrors() throws Exception {
        mvc.perform(post("/api/expenses")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"amount": 0, "description": "", "date": "2026-09-25", "category": "COMIDA"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Revisá los datos del gasto."))
                .andExpect(jsonPath("$.errors.amount").value("El importe tiene que ser mayor a cero"))
                .andExpect(jsonPath("$.errors.description").exists())
                .andExpect(jsonPath("$.errors.paymentMethod").exists());
    }

    @Test
    void rejectsUnknownCategory() throws Exception {
        mvc.perform(post("/api/expenses")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json("100", "Algo", "2026-09-25", "INVENTADA")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Los datos enviados no son válidos."));
    }

    @Test
    void rejectsFutureDate() throws Exception {
        String future = LocalDate.now().plusDays(5).toString();
        mvc.perform(post("/api/expenses")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json("100", "Algo", future, "OTROS")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.date").value("La fecha no puede ser futura"));
    }

    @Test
    void listsByDateRangeNewestFirst() throws Exception {
        create("100", "Agosto", "2026-08-31", "OTROS");
        create("200", "Primero", "2026-09-01", "COMIDA");
        create("300", "Último", "2026-09-20", "COMIDA");

        mvc.perform(get("/api/expenses").param("from", "2026-09-01").param("to", "2026-09-30"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].description").value("Último"))
                .andExpect(jsonPath("$[1].description").value("Primero"));

        mvc.perform(get("/api/expenses"))
                .andExpect(jsonPath("$", hasSize(3)));
    }

    @Test
    void updatesAndDeletes() throws Exception {
        long id = create("100", "Café", "2026-09-10", "COMIDA");

        mvc.perform(put("/api/expenses/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json("250", "Café con medialunas", "2026-09-11", "COMIDA")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.amount").value(250))
                .andExpect(jsonPath("$.description").value("Café con medialunas"))
                .andExpect(jsonPath("$.date").value("2026-09-11"));

        mvc.perform(delete("/api/expenses/{id}", id)).andExpect(status().isNoContent());

        mvc.perform(get("/api/expenses/{id}", id))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("El gasto no existe o ya fue eliminado."));
    }

    @Test
    void dashboardSumsTheMonth() throws Exception {
        create("1000", "Almuerzo", "2026-09-10", "COMIDA");
        create("3000", "Uber", "2026-09-12", "TRANSPORTE");
        create("2000", "Agosto", "2026-08-15", "OTROS");

        mvc.perform(get("/api/dashboard").param("month", "2026-09"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.month").value("2026-09"))
                .andExpect(jsonPath("$.total").value(4000))
                .andExpect(jsonPath("$.previousMonthTotal").value(2000))
                .andExpect(jsonPath("$.changePercent").value(100.0))
                .andExpect(jsonPath("$.byCategory[0].category").value("TRANSPORTE"))
                .andExpect(jsonPath("$.byCategory[0].percent").value(75.0))
                .andExpect(jsonPath("$.recent", hasSize(3)));
    }

    @Test
    void invalidMonthIsABadRequest() throws Exception {
        mvc.perform(get("/api/dashboard").param("month", "septiembre"))
                .andExpect(status().isBadRequest());
    }
}
