package com.misgastos.service;

import com.misgastos.dto.RegisterRequest;
import com.misgastos.model.AppUser;
import com.misgastos.repository.AppUserRepository;
import com.misgastos.security.AttemptLimiter;
import com.misgastos.security.SecurityConfig.LoginLimiters;
import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.NoOpPasswordEncoder;

import java.sql.SQLException;
import java.time.Clock;
import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** "Ese nombre de usuario ya está en uso" solo aparece si de verdad hay un duplicado. */
class AuthServiceRegisterTest {

    private final AppUserRepository users = mock(AppUserRepository.class);

    @SuppressWarnings("deprecation")
    private final AuthService service = new AuthService(users, NoOpPasswordEncoder.getInstance(), new LoginLimiters(
            new AttemptLimiter(10, Duration.ofMinutes(15), Clock.systemUTC()),
            new AttemptLimiter(30, Duration.ofMinutes(15), Clock.systemUTC()),
            new AttemptLimiter(10, Duration.ofHours(1), Clock.systemUTC())));

    private static DataIntegrityViolationException violation(String constraint) {
        return new DataIntegrityViolationException("falló",
                new ConstraintViolationException("falló", new SQLException("falló", "23000"), constraint));
    }

    private static RegisterRequest request(String username) {
        return new RegisterRequest(username, "secreto1", "secreto1");
    }

    @Test
    void otherDatabaseErrorsAreNotReportedAsUsernameTaken() {
        when(users.existsByUsername("nuevo")).thenReturn(false);
        when(users.saveAndFlush(any(AppUser.class))).thenThrow(violation("CONSTRAINT_45"));

        assertThatThrownBy(() -> service.register(request("nuevo"), "1.1.1.1"))
                .isInstanceOf(DataIntegrityViolationException.class)
                .isNotInstanceOf(ApiException.class);
    }

    @Test
    void aSimultaneousDuplicateIsReportedAsUsernameTaken() {
        // Pasó el chequeo previo, pero otro registro con el mismo nombre se guardó un instante antes
        when(users.existsByUsername("ana")).thenReturn(false);
        when(users.saveAndFlush(any(AppUser.class))).thenThrow(violation("PUBLIC.UK_APP_USER_USERNAME"));

        assertThatThrownBy(() -> service.register(request("Ana"), "1.1.1.1"))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(e.getErrors()).containsEntry("username", "Ese nombre de usuario ya está en uso.");
                });
    }

    @Test
    void anExistingUsernameIsRejectedBeforeSaving() {
        when(users.existsByUsername("ana")).thenReturn(true);

        assertThatThrownBy(() -> service.register(request(" ANA "), "1.1.1.1"))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.CONFLICT));
    }
}
