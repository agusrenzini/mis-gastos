package com.misgastos.controller;

import com.misgastos.dto.ChangePasswordRequest;
import com.misgastos.dto.LoginRequest;
import com.misgastos.dto.MeResponse;
import com.misgastos.dto.RegisterRequest;
import com.misgastos.model.AppUser;
import com.misgastos.security.AppUserPrincipal;
import com.misgastos.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.RememberMeServices;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Registro, inicio de sesión y cambio de contraseña. El cierre de sesión (POST /api/auth/logout) lo maneja Spring Security. */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final SecurityContextRepository securityContextRepository;
    private final RememberMeServices rememberMeServices;

    public AuthController(AuthService authService, SecurityContextRepository securityContextRepository,
                          RememberMeServices rememberMeServices) {
        this.authService = authService;
        this.securityContextRepository = securityContextRepository;
        this.rememberMeServices = rememberMeServices;
    }

    /** Crea una cuenta común (nunca administradora) y deja la sesión iniciada. */
    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public MeResponse register(@Valid @RequestBody RegisterRequest body,
                               HttpServletRequest request, HttpServletResponse response) {
        AppUser user = authService.register(body, request.getRemoteAddr());
        return startSession(user, request, response);
    }

    @PostMapping("/login")
    public MeResponse login(@Valid @RequestBody LoginRequest body,
                            HttpServletRequest request, HttpServletResponse response) {
        AppUser user = authService.authenticate(body.username(), body.password(), request.getRemoteAddr());
        return startSession(user, request, response);
    }

    @GetMapping("/me")
    public MeResponse me(@AuthenticationPrincipal AppUserPrincipal user) {
        return MeResponse.from(user);
    }

    /** Después de cambiarla, la sesión sigue abierta en este dispositivo (y se cierra en los demás). */
    @PostMapping("/change-password")
    public MeResponse changePassword(@AuthenticationPrincipal AppUserPrincipal current,
                                     @Valid @RequestBody ChangePasswordRequest body,
                                     HttpServletRequest request, HttpServletResponse response) {
        AppUser user = authService.changePassword(current.id(), body);
        return startSession(user, request, response);
    }

    private MeResponse startSession(AppUser user, HttpServletRequest request, HttpServletResponse response) {
        AppUserPrincipal principal = AppUserPrincipal.from(user);
        Authentication auth = UsernamePasswordAuthenticationToken.authenticated(principal, null, principal.getAuthorities());

        // Nuevo id de sesión al iniciar sesión (evita que alguien fije una sesión de antemano).
        if (request.getSession(false) != null) {
            request.changeSessionId();
        }
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(auth);
        SecurityContextHolder.setContext(context);
        securityContextRepository.saveContext(context, request, response);
        rememberMeServices.loginSuccess(request, response, auth);
        return MeResponse.from(principal);
    }
}
