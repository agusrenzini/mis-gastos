package com.misgastos.service;

import com.misgastos.dto.ChangePasswordRequest;
import com.misgastos.dto.RegisterRequest;
import com.misgastos.model.AppUser;
import com.misgastos.model.Role;
import com.misgastos.repository.AppUserRepository;
import com.misgastos.security.SecurityConfig.LoginLimiters;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Optional;

/** Registro, verificación de credenciales y cambio de contraseña. */
@Service
public class AuthService {

    static final String BAD_CREDENTIALS = "Usuario o contraseña incorrectos.";
    static final String TOO_MANY_ATTEMPTS = "Demasiados intentos. Esperá unos minutos y probá de nuevo.";
    static final String ACCOUNT_DISABLED = "Tu cuenta está desactivada. Si creés que es un error, hablá con el administrador.";
    static final String USERNAME_TAKEN = "Ese nombre de usuario ya está en uso.";

    /** BCrypt solo usa los primeros 72 bytes de la contraseña. */
    private static final int MAX_PASSWORD_BYTES = 72;

    private final AppUserRepository users;
    private final PasswordEncoder encoder;
    private final LoginLimiters limiters;
    /** Hash de relleno: si el usuario no existe se compara igual, para tardar lo mismo y no revelar si existe. */
    private final String dummyHash;

    public AuthService(AppUserRepository users, PasswordEncoder encoder, LoginLimiters limiters) {
        this.users = users;
        this.encoder = encoder;
        this.limiters = limiters;
        this.dummyHash = encoder.encode("contraseña-de-relleno");
    }

    public static String normalizeUsername(String username) {
        return username.trim().toLowerCase(Locale.ROOT);
    }

    @Transactional
    public AppUser register(RegisterRequest request, String ip) {
        if (limiters.registerByIp().isBlocked(ip)) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, TOO_MANY_ATTEMPTS);
        }
        limiters.registerByIp().record(ip);

        String username = normalizeUsername(request.username());
        checkNewPassword("password", request.password(), request.confirmPassword());
        if (users.existsByUsername(username)) {
            throw ApiException.field(HttpStatus.CONFLICT, "username", USERNAME_TAKEN);
        }

        AppUser user = new AppUser();
        user.setUsername(username);
        user.setPasswordHash(encoder.encode(request.password()));
        user.setRole(Role.USER);
        try {
            return users.saveAndFlush(user);
        } catch (DataIntegrityViolationException e) {
            // Dos registros simultáneos con el mismo nombre
            throw ApiException.field(HttpStatus.CONFLICT, "username", USERNAME_TAKEN);
        }
    }

    /** Devuelve el usuario si la contraseña es correcta y la cuenta está activa. */
    @Transactional(readOnly = true)
    public AppUser authenticate(String rawUsername, String password, String ip) {
        String username = normalizeUsername(rawUsername);
        if (limiters.loginByUsername().isBlocked(username) || limiters.loginByIp().isBlocked(ip)) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, TOO_MANY_ATTEMPTS);
        }

        Optional<AppUser> user = users.findByUsername(username);
        boolean valid = matches(password, user.map(AppUser::getPasswordHash).orElse(dummyHash)) && user.isPresent();
        if (!valid) {
            limiters.loginByUsername().record(username);
            limiters.loginByIp().record(ip);
            throw new ApiException(HttpStatus.UNAUTHORIZED, BAD_CREDENTIALS);
        }
        if (!user.get().isActive()) {
            throw new ApiException(HttpStatus.FORBIDDEN, ACCOUNT_DISABLED);
        }
        limiters.loginByUsername().reset(username);
        return user.get();
    }

    @Transactional
    public AppUser changePassword(Long userId, ChangePasswordRequest request) {
        AppUser user = users.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Tenés que iniciar sesión."));
        if (limiters.loginByUsername().isBlocked(user.getUsername())) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, TOO_MANY_ATTEMPTS);
        }
        if (!matches(request.currentPassword(), user.getPasswordHash())) {
            limiters.loginByUsername().record(user.getUsername());
            throw ApiException.field(HttpStatus.BAD_REQUEST, "currentPassword", "La contraseña actual no es correcta.");
        }
        checkNewPassword("newPassword", request.newPassword(), request.confirmPassword());
        if (matches(request.newPassword(), user.getPasswordHash())) {
            throw ApiException.field(HttpStatus.BAD_REQUEST, "newPassword",
                    "La contraseña nueva tiene que ser distinta de la actual.");
        }
        user.setPasswordHash(encoder.encode(request.newPassword()));
        user.setMustChangePassword(false);
        return users.saveAndFlush(user);
    }

    private void checkNewPassword(String field, String password, String confirmation) {
        if (password.getBytes(StandardCharsets.UTF_8).length > MAX_PASSWORD_BYTES) {
            throw ApiException.field(HttpStatus.BAD_REQUEST, field, "La contraseña es demasiado larga.");
        }
        if (!password.equals(confirmation)) {
            throw ApiException.field(HttpStatus.BAD_REQUEST, "confirmPassword", "Las contraseñas no coinciden.");
        }
    }

    private boolean matches(String password, String hash) {
        if (password.getBytes(StandardCharsets.UTF_8).length > MAX_PASSWORD_BYTES) {
            return false;
        }
        return encoder.matches(password, hash);
    }
}
