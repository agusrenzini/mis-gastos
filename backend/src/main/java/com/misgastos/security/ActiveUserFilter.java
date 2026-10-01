package com.misgastos.security;

import com.misgastos.model.AppUser;
import com.misgastos.repository.AppUserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.RememberMeServices;
import org.springframework.security.web.authentication.logout.LogoutHandler;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Optional;

/**
 * En cada pedido a /api vuelve a leer al usuario de la base. Así:
 *  - una cuenta desactivada pierde el acceso al instante, aunque tenga la sesión abierta;
 *  - si el administrador restablece la contraseña, las sesiones viejas se cierran;
 *  - el rol (USER / ADMIN) siempre es el actual, no el que había al iniciar sesión.
 * Si el usuario debe cambiar su contraseña, solo puede usar /api/auth/** hasta hacerlo.
 */
public class ActiveUserFilter extends OncePerRequestFilter {

    private final AppUserRepository users;
    private final RememberMeServices rememberMeServices;

    public ActiveUserFilter(AppUserRepository users, RememberMeServices rememberMeServices) {
        this.users = users;
        this.rememberMeServices = rememberMeServices;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (!(auth != null && auth.getPrincipal() instanceof AppUserPrincipal sessionUser)) {
            chain.doFilter(request, response);
            return;
        }

        Optional<AppUser> current = users.findById(sessionUser.id());
        boolean stillValid = current.isPresent()
                && current.get().isActive()
                && current.get().getPasswordHash().equals(sessionUser.passwordHash());
        if (!stillValid) {
            endSession(request, response, auth);
            chain.doFilter(request, response);
            return;
        }

        AppUserPrincipal fresh = AppUserPrincipal.from(current.get());
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(fresh, null, fresh.getAuthorities()));
        SecurityContextHolder.setContext(context);

        if (fresh.mustChangePassword() && !request.getRequestURI().startsWith("/api/auth/")) {
            JsonErrors.write(response, HttpServletResponse.SC_FORBIDDEN, JsonErrors.MUST_CHANGE_PASSWORD);
            return;
        }
        chain.doFilter(request, response);
    }

    private void endSession(HttpServletRequest request, HttpServletResponse response, Authentication auth) {
        SecurityContextHolder.clearContext();
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        if (rememberMeServices instanceof LogoutHandler handler) {
            handler.logout(request, response, auth);
        }
    }
}
