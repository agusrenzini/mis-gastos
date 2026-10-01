package com.misgastos.controller;

import com.misgastos.DatabaseCleaner;
import com.misgastos.model.AppUser;
import com.misgastos.model.Category;
import com.misgastos.model.Expense;
import com.misgastos.model.ExpenseSource;
import com.misgastos.model.PaymentMethod;
import com.misgastos.model.Role;
import com.misgastos.repository.AppUserRepository;
import com.misgastos.repository.ExpenseRepository;
import com.misgastos.security.SecurityConfig.LoginLimiters;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Registro, login, separación de datos entre usuarios y panel de administración.
 * Usa sesiones reales (cookies de sesión), igual que el navegador.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AccountSecurityTest {

    private static final String EXPENSE = """
            {"amount": 1500, "description": "Café", "date": "2026-09-20",
             "category": "COMIDA", "paymentMethod": "EFECTIVO"}""";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private DatabaseCleaner cleaner;

    @Autowired
    private AppUserRepository users;

    @Autowired
    private ExpenseRepository expenses;

    @Autowired
    private LoginLimiters limiters;

    @Autowired
    private com.zaxxer.hikari.HikariDataSource dataSource;

    @BeforeEach
    void cleanDatabase() {
        cleaner.clean();
        limiters.clear();
    }

    // ---------- Ayudas ----------

    private static String credentials(String username, String password) {
        return """
                {"username": "%s", "password": "%s"}""".formatted(username, password);
    }

    private static String registration(String username, String password, String confirm) {
        return """
                {"username": "%s", "password": "%s", "confirmPassword": "%s"}""".formatted(username, password, confirm);
    }

    private ResultActions send(MockHttpServletRequestBuilder request, MockHttpSession session, String body) throws Exception {
        if (session != null) {
            request.session(session);
        }
        if (body != null) {
            request.contentType(MediaType.APPLICATION_JSON).content(body);
        }
        return mvc.perform(request.with(csrf()));
    }

    private MockHttpSession sessionOf(MvcResult result) {
        return (MockHttpSession) result.getRequest().getSession(false);
    }

    private MockHttpSession register(String username, String password) throws Exception {
        MvcResult result = send(post("/api/auth/register"), null, registration(username, password, password))
                .andExpect(status().isCreated())
                .andReturn();
        return sessionOf(result);
    }

    private MockHttpSession login(String username, String password) throws Exception {
        MvcResult result = send(post("/api/auth/login"), null, credentials(username, password))
                .andExpect(status().isOk())
                .andReturn();
        return sessionOf(result);
    }

    private MockHttpSession registerAdmin(String username, String password) throws Exception {
        register(username, password);
        AppUser admin = users.findByUsername(username).orElseThrow();
        admin.setRole(Role.ADMIN);
        users.save(admin);
        return login(username, password);
    }

    private long createExpense(MockHttpSession session) throws Exception {
        String body = send(post("/api/expenses"), session, EXPENSE)
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return Long.parseLong(body.replaceAll(".*\"id\":(\\d+).*", "$1"));
    }

    private Long userId(String username) {
        return users.findByUsername(username).orElseThrow().getId();
    }

    // ---------- Registro ----------

    @Test
    void registerCreatesCommonUserWithHashedPasswordAndStartsSession() throws Exception {
        // Aunque alguien mande "role": "ADMIN", la cuenta nueva es USER.
        MvcResult result = send(post("/api/auth/register"), null, """
                {"username": "Ana", "password": "secreto1", "confirmPassword": "secreto1", "role": "ADMIN"}""")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.username").value("ana"))
                .andExpect(jsonPath("$.role").value("USER"))
                .andReturn();

        AppUser saved = users.findByUsername("ana").orElseThrow();
        assertThat(saved.getRole()).isEqualTo(Role.USER);
        assertThat(saved.getPasswordHash()).startsWith("{bcrypt}").doesNotContain("secreto1");

        send(get("/api/auth/me"), sessionOf(result), null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("ana"));
    }

    @Test
    void registerValidatesWithSimpleMessages() throws Exception {
        send(post("/api/auth/register"), null, registration("ana", "123", "123"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.password").value("La contraseña tiene que tener al menos 6 caracteres"));

        send(post("/api/auth/register"), null, registration("ana", "secreto1", "secreto2"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.confirmPassword").value("Las contraseñas no coinciden."));

        send(post("/api/auth/register"), null, registration("a b", "secreto1", "secreto1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.username").exists());

        register("ana", "secreto1");
        // Mismo nombre con otras mayúsculas: es el mismo usuario
        send(post("/api/auth/register"), null, registration("ANA", "otraclave", "otraclave"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errors.username").value("Ese nombre de usuario ya está en uso."));
    }

    @Test
    void theDatabaseNamesTheDuplicateUsernameConstraint() {
        // Lo que usa AuthService para distinguir un duplicado real de cualquier otro error
        AppUser first = new AppUser();
        first.setUsername("ana");
        first.setPasswordHash("x");
        users.saveAndFlush(first);
        AppUser second = new AppUser();
        second.setUsername("ana");
        second.setPasswordHash("y");
        assertThatThrownBy(() -> users.saveAndFlush(second))
                .isInstanceOf(DataIntegrityViolationException.class)
                .satisfies(e -> assertThat(isUsernameDuplicate(e)).isTrue());
    }

    private static boolean isUsernameDuplicate(Throwable e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof org.hibernate.exception.ConstraintViolationException v) {
                return v.getConstraintName() != null && v.getConstraintName().toLowerCase().contains("uk_app_user_username");
            }
        }
        return false;
    }

    @Test
    void theTestDatabaseNeverRenewsConnections() {
        // Con H2, las restricciones CHECK quedan atadas a la conexión que las creó: si el pool la renueva
        // (por defecto cada 30 minutos), todos los registros nuevos fallan. Ver application-test.properties.
        assertThat(dataSource.getMaxLifetime()).isZero();
        assertThat(dataSource.getIdleTimeout()).isZero();
    }

    @Test
    void registrationsAreLimitedPerIp() throws Exception {
        for (int i = 0; i < 10; i++) {
            mvc.perform(post("/api/auth/register").with(csrf()).with(remoteAddr("10.0.0.9"))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(registration("user" + i, "secreto1", "secreto1")))
                    .andExpect(status().isCreated());
        }
        mvc.perform(post("/api/auth/register").with(csrf()).with(remoteAddr("10.0.0.9"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registration("user99", "secreto1", "secreto1")))
                .andExpect(status().isTooManyRequests());
        // Otra IP puede seguir registrándose
        mvc.perform(post("/api/auth/register").with(csrf()).with(remoteAddr("10.0.0.10"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registration("user99", "secreto1", "secreto1")))
                .andExpect(status().isCreated());
    }

    private static RequestPostProcessor remoteAddr(String ip) {
        return request -> {
            request.setRemoteAddr(ip);
            return request;
        };
    }

    // ---------- Login ----------

    @Test
    void loginRejectsWrongCredentialsWithTheSameMessage() throws Exception {
        register("ana", "secreto1");

        send(post("/api/auth/login"), null, credentials("ana", "incorrecta"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Usuario o contraseña incorrectos."));
        send(post("/api/auth/login"), null, credentials("nadie", "incorrecta"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Usuario o contraseña incorrectos."));

        send(post("/api/auth/login"), null, credentials(" ANA ", "secreto1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("ana"))
                .andExpect(cookie().exists("remember-me"));
    }

    @Test
    void repeatedFailedLoginsAreBlockedForThatUser() throws Exception {
        register("ana", "secreto1");
        register("beto", "secreto2");
        for (int i = 0; i < 10; i++) {
            send(post("/api/auth/login"), null, credentials("ana", "mal" + i)).andExpect(status().isUnauthorized());
        }
        // Bloqueado aunque ahora la contraseña sea correcta
        send(post("/api/auth/login"), null, credentials("ana", "secreto1"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value("Demasiados intentos. Esperá unos minutos y probá de nuevo."));
        // Los demás usuarios entran normalmente
        login("beto", "secreto2");
    }

    @Test
    void logoutEndsTheSession() throws Exception {
        MockHttpSession session = register("ana", "secreto1");
        send(post("/api/auth/logout"), session, null).andExpect(status().isNoContent());
        send(get("/api/auth/me"), session, null).andExpect(status().isUnauthorized());
    }

    @Test
    void rememberMeCookieKeepsTheUserLoggedIn() throws Exception {
        register("ana", "secreto1");
        Cookie rememberMe = send(post("/api/auth/login"), null, credentials("ana", "secreto1"))
                .andReturn().getResponse().getCookie("remember-me");

        // Sin sesión (por ejemplo, después de reiniciar el servidor), solo con la cookie
        mvc.perform(get("/api/auth/me").cookie(rememberMe))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("ana"));
    }

    @Test
    void logoutRevokesTheRememberMeCookieOnTheServer() throws Exception {
        register("ana", "secreto1");
        MvcResult result = send(post("/api/auth/login"), null, credentials("ana", "secreto1")).andReturn();
        Cookie rememberMe = result.getResponse().getCookie("remember-me");
        MockHttpSession session = sessionOf(result);

        // La cookie funciona antes de cerrar sesión
        mvc.perform(get("/api/auth/me").cookie(rememberMe)).andExpect(status().isOk());

        // Al cerrar sesión, el navegador recibe la orden de borrarla...
        MvcResult logout = send(post("/api/auth/logout"), session, null).andExpect(status().isNoContent()).andReturn();
        assertThat(logout.getResponse().getCookie("remember-me").getMaxAge()).isZero();
        // ...y aunque alguien haya guardado una copia, ya no sirve
        mvc.perform(get("/api/auth/me").cookie(rememberMe)).andExpect(status().isUnauthorized());

        // Volver a ingresar entrega una cookie nueva que sí funciona
        Cookie fresh = send(post("/api/auth/login"), null, credentials("ana", "secreto1"))
                .andReturn().getResponse().getCookie("remember-me");
        mvc.perform(get("/api/auth/me").cookie(fresh)).andExpect(status().isOk());
    }

    @Test
    void logoutWithOnlyTheRememberMeCookieAlsoRevokesIt() throws Exception {
        register("ana", "secreto1");
        Cookie rememberMe = send(post("/api/auth/login"), null, credentials("ana", "secreto1"))
                .andReturn().getResponse().getCookie("remember-me");
        // Sin sesión en el servidor (por ejemplo, después de un reinicio), solo con la cookie
        mvc.perform(post("/api/auth/logout").cookie(rememberMe).with(csrf())).andExpect(status().isNoContent());
        mvc.perform(get("/api/auth/me").cookie(rememberMe)).andExpect(status().isUnauthorized());
    }

    // ---------- Protección general ----------

    @Test
    void apiRequiresLogin() throws Exception {
        mvc.perform(get("/api/expenses"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Tenés que iniciar sesión."));
        mvc.perform(get("/api/dashboard")).andExpect(status().isUnauthorized());
        // El frontend sigue siendo público (la pantalla de login tiene que cargar)
        mvc.perform(get("/manifest.json")).andExpect(status().isOk());
    }

    @Test
    void changesRequireTheCsrfToken() throws Exception {
        MockHttpSession session = register("ana", "secreto1");
        mvc.perform(post("/api/expenses").session(session)
                        .contentType(MediaType.APPLICATION_JSON).content(EXPENSE))
                .andExpect(status().isForbidden());

        // Con el token CSRF (el frontend lo toma de la cookie XSRF-TOKEN) sí funciona.
        send(post("/api/expenses"), session, EXPENSE).andExpect(status().isCreated());
    }

    // ---------- Separación de datos ----------

    @Test
    void eachUserOnlySeesAndChangesTheirOwnExpenses() throws Exception {
        MockHttpSession ana = register("ana", "secreto1");
        MockHttpSession beto = register("beto", "secreto2");
        long anaExpense = createExpense(ana);
        createExpense(beto);

        send(get("/api/expenses"), ana, null).andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(anaExpense));
        send(get("/api/expenses"), beto, null).andExpect(jsonPath("$", hasSize(1)));

        // Beto intenta usar el id de un gasto de Ana: responde como si no existiera
        send(get("/api/expenses/{id}", anaExpense), beto, null).andExpect(status().isNotFound());
        send(put("/api/expenses/{id}", anaExpense), beto, EXPENSE.replace("Café", "Hackeado"))
                .andExpect(status().isNotFound());
        send(delete("/api/expenses/{id}", anaExpense), beto, null).andExpect(status().isNotFound());

        // El gasto de Ana sigue intacto
        send(get("/api/expenses/{id}", anaExpense), ana, null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.description").value("Café"));

        // Los resúmenes también están separados
        send(get("/api/dashboard").param("month", "2026-09"), beto, null)
                .andExpect(jsonPath("$.total").value(1500))
                .andExpect(jsonPath("$.recent", hasSize(1)));
        send(get("/api/statistics").param("period", "MONTH").param("date", "2026-09-20"), ana, null)
                .andExpect(jsonPath("$.total").value(1500))
                .andExpect(jsonPath("$.expenseCount").value(1));
    }

    // ---------- Panel de administración ----------

    @Test
    void commonUsersCannotUseTheAdminPanel() throws Exception {
        MockHttpSession beto = register("beto", "secreto2");
        long betoId = userId("beto");

        send(get("/api/admin/users"), beto, null)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("No tenés permiso para hacer esto."));
        send(post("/api/admin/users/{id}/deactivate", betoId), beto, null).andExpect(status().isForbidden());
        send(post("/api/admin/users/{id}/activate", betoId), beto, null).andExpect(status().isForbidden());
        send(post("/api/admin/users/{id}/reset-password", betoId), beto, null).andExpect(status().isForbidden());
        send(get("/api/admin/unassigned-expenses"), beto, null).andExpect(status().isForbidden());
        send(post("/api/admin/unassigned-expenses/assign-to-me"), beto, null).andExpect(status().isForbidden());

        // Sin sesión: 401
        mvc.perform(get("/api/admin/users")).andExpect(status().isUnauthorized());
    }

    @Test
    void adminSeesActivitySummaryWithoutPasswords() throws Exception {
        MockHttpSession admin = registerAdmin("agus", "claveadmin");
        MockHttpSession ana = register("ana", "secreto1");
        createExpense(ana);
        createExpense(ana);
        register("beto", "secreto2");

        String body = send(get("/api/admin/users"), admin, null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[0].username").value("agus"))
                .andExpect(jsonPath("$[0].role").value("ADMIN"))
                .andExpect(jsonPath("$[1].username").value("ana"))
                .andExpect(jsonPath("$[1].expenseCount").value(2))
                .andExpect(jsonPath("$[1].lastExpenseAt").isNotEmpty())
                .andExpect(jsonPath("$[1].createdAt").isNotEmpty())
                .andExpect(jsonPath("$[2].expenseCount").value(0))
                .andExpect(jsonPath("$[2].lastExpenseAt").isEmpty())
                .andReturn().getResponse().getContentAsString();

        assertThat(body).doesNotContain("passwordHash", "bcrypt", "secreto", "Café", "amount");
    }

    @Test
    void deactivatedAccountsLoseAccessButKeepTheirData() throws Exception {
        MockHttpSession admin = registerAdmin("agus", "claveadmin");
        MockHttpSession ana = register("ana", "secreto1");
        createExpense(ana);
        long anaId = userId("ana");

        send(post("/api/admin/users/{id}/deactivate", anaId), admin, null).andExpect(status().isNoContent());

        // La sesión abierta deja de funcionar y no puede volver a entrar
        send(get("/api/expenses"), ana, null).andExpect(status().isUnauthorized());
        send(post("/api/auth/login"), null, credentials("ana", "secreto1"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value(
                        "Tu cuenta está desactivada. Si creés que es un error, hablá con el administrador."));
        send(get("/api/admin/users"), admin, null).andExpect(jsonPath("$[1].active").value(false))
                .andExpect(jsonPath("$[1].expenseCount").value(1));

        send(post("/api/admin/users/{id}/activate", anaId), admin, null).andExpect(status().isNoContent());
        MockHttpSession again = login("ana", "secreto1");
        send(get("/api/expenses"), again, null).andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    void adminCannotDeactivateOrResetThemselves() throws Exception {
        MockHttpSession admin = registerAdmin("agus", "claveadmin");
        long adminId = userId("agus");
        send(post("/api/admin/users/{id}/deactivate", adminId), admin, null)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("No podés desactivar tu propia cuenta."));
        send(post("/api/admin/users/{id}/reset-password", adminId), admin, null)
                .andExpect(status().isBadRequest());
        send(post("/api/admin/users/{id}/deactivate", 999_999), admin, null)
                .andExpect(status().isNotFound());
    }

    @Test
    void passwordResetGivesATemporaryPasswordThatMustBeChanged() throws Exception {
        MockHttpSession admin = registerAdmin("agus", "claveadmin");
        MockHttpSession ana = register("ana", "secreto1");
        Cookie rememberMe = send(post("/api/auth/login"), null, credentials("ana", "secreto1"))
                .andReturn().getResponse().getCookie("remember-me");
        createExpense(ana);
        String hashBefore = users.findByUsername("ana").orElseThrow().getPasswordHash();

        String body = send(post("/api/admin/users/{id}/reset-password", userId("ana")), admin, null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("ana"))
                .andReturn().getResponse().getContentAsString();
        String temporary = body.replaceAll(".*\"temporaryPassword\":\"([^\"]+)\".*", "$1");
        assertThat(temporary).matches("[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}");
        assertThat(body).doesNotContain("secreto1", hashBefore);

        // La contraseña vieja, la sesión abierta y la cookie "recordarme" dejan de servir
        send(post("/api/auth/login"), null, credentials("ana", "secreto1")).andExpect(status().isUnauthorized());
        send(get("/api/expenses"), ana, null).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/auth/me").cookie(rememberMe)).andExpect(status().isUnauthorized());

        // Con la temporal entra, pero tiene que cambiarla antes de usar la app
        MvcResult result = send(post("/api/auth/login"), null, credentials("ana", temporary))
                .andExpect(jsonPath("$.mustChangePassword").value(true))
                .andReturn();
        MockHttpSession temp = sessionOf(result);
        send(get("/api/expenses"), temp, null)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Antes de seguir, cambiá tu contraseña."));

        send(post("/api/auth/change-password"), temp, """
                {"currentPassword": "%s", "newPassword": "nueva123", "confirmPassword": "nueva123"}"""
                .formatted(temporary))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mustChangePassword").value(false));

        // Sigue con la sesión abierta y sus datos intactos
        send(get("/api/expenses"), temp, null).andExpect(jsonPath("$", hasSize(1)));
        login("ana", "nueva123");
    }

    @Test
    void changePasswordChecksTheCurrentOne() throws Exception {
        MockHttpSession ana = register("ana", "secreto1");
        send(post("/api/auth/change-password"), ana, """
                {"currentPassword": "mal", "newPassword": "nueva123", "confirmPassword": "nueva123"}""")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.currentPassword").value("La contraseña actual no es correcta."));
        send(post("/api/auth/change-password"), ana, """
                {"currentPassword": "secreto1", "newPassword": "nueva123", "confirmPassword": "otra1234"}""")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.confirmPassword").value("Las contraseñas no coinciden."));
    }

    @Test
    void roleChangesApplyToOpenSessions() throws Exception {
        MockHttpSession admin = registerAdmin("agus", "claveadmin");
        send(get("/api/admin/users"), admin, null).andExpect(status().isOk());

        AppUser user = users.findByUsername("agus").orElseThrow();
        user.setRole(Role.USER);
        users.save(user);

        send(get("/api/admin/users"), admin, null).andExpect(status().isForbidden());
    }

    @Test
    void adminReviewsAndClaimsExpensesFromBeforeAccounts() throws Exception {
        Expense old = new Expense();
        old.setAmount(new BigDecimal("2500"));
        old.setDescription("Gasto viejo");
        old.setDate(LocalDate.parse("2026-09-10"));
        old.setCategory(Category.OTROS);
        old.setPaymentMethod(PaymentMethod.DEBITO);
        old.setSource(ExpenseSource.MANUAL);
        expenses.save(old);

        MockHttpSession admin = registerAdmin("agus", "claveadmin");
        MockHttpSession ana = register("ana", "secreto1");

        // Nadie ve los gastos sin dueño, ni siquiera pidiéndolos por id
        send(get("/api/expenses"), ana, null).andExpect(jsonPath("$", hasSize(0)));
        send(get("/api/expenses"), admin, null).andExpect(jsonPath("$", hasSize(0)));
        long oldId = old.getId();
        send(get("/api/expenses/{id}", oldId), ana, null).andExpect(status().isNotFound());
        send(put("/api/expenses/{id}", oldId), ana, EXPENSE).andExpect(status().isNotFound());
        send(delete("/api/expenses/{id}", oldId), ana, null).andExpect(status().isNotFound());

        // Un usuario común no puede asignárselos
        send(post("/api/admin/unassigned-expenses/assign-to-me"), ana, null).andExpect(status().isForbidden());
        assertThat(expenses.findById(oldId).orElseThrow().getUserId()).isNull();
        assertThat(expenses.findById(oldId).orElseThrow().getDescription()).isEqualTo("Gasto viejo");

        send(get("/api/admin/unassigned-expenses"), admin, null)
                .andExpect(jsonPath("$.count").value(1))
                .andExpect(jsonPath("$.firstDate").value("2026-09-10"));

        send(post("/api/admin/unassigned-expenses/assign-to-me"), admin, null)
                .andExpect(jsonPath("$.assigned").value(1));

        send(get("/api/expenses"), admin, null).andExpect(jsonPath("$[0].description").value("Gasto viejo"));
        assertThat(expenses.findById(oldId).orElseThrow().getUserId()).isEqualTo(userId("agus"));
        send(get("/api/expenses"), ana, null).andExpect(jsonPath("$", hasSize(0)));
        send(get("/api/admin/unassigned-expenses"), admin, null).andExpect(jsonPath("$.count").value(0));
    }
}
