package com.misgastos.security;

import com.misgastos.repository.AppUserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.RememberMeServices;
import org.springframework.security.web.authentication.logout.LogoutHandler;

/**
 * Al cerrar sesión, además de borrar la cookie "recordarme" del navegador, la anula en el servidor
 * (incrementa sessionVersion). Así una copia de esa cookie ya no sirve para entrar.
 * Las cookies "recordarme" de otros dispositivos de la misma cuenta también dejan de valer.
 */
class RevokeRememberMeHandler implements LogoutHandler {

    private final AppUserRepository users;
    private final RememberMeServices rememberMeServices;

    RevokeRememberMeHandler(AppUserRepository users, RememberMeServices rememberMeServices) {
        this.users = users;
        this.rememberMeServices = rememberMeServices;
    }

    @Override
    public void logout(HttpServletRequest request, HttpServletResponse response, Authentication authentication) {
        Authentication auth = authentication;
        if (auth == null) {
            // Sin sesión en el servidor, pero quizás con cookie "recordarme": se identifica al usuario con ella.
            auth = rememberMeServices.autoLogin(request, response);
        }
        if (auth != null && auth.getPrincipal() instanceof AppUserPrincipal user) {
            users.incrementSessionVersion(user.id());
        }
    }
}
