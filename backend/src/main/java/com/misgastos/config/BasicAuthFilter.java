package com.misgastos.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.Set;

/**
 * Protección mínima para cuando la app está publicada en internet.
 * Si APP_PASSWORD está vacía (desarrollo local), no hace nada.
 * Si tiene valor, el navegador pide usuario y contraseña una vez y los recuerda.
 */
@Component
public class BasicAuthFilter extends OncePerRequestFilter {

    /** Archivos que el navegador pide sin credenciales para instalar la PWA. No contienen datos. */
    private static final Set<String> PUBLIC_PATHS = Set.of("/manifest.json", "/service-worker.js");

    private final byte[] expectedHeader;

    public BasicAuthFilter(@Value("${app.auth.username}") String username,
                           @Value("${app.auth.password}") String password) {
        this.expectedHeader = password.isBlank()
                ? null
                : ("Basic " + Base64.getEncoder().encodeToString(
                        (username + ":" + password).getBytes(StandardCharsets.UTF_8)))
                        .getBytes(StandardCharsets.UTF_8);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return expectedHeader == null || PUBLIC_PATHS.contains(path) || path.startsWith("/icons/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        boolean valid = header != null
                && MessageDigest.isEqual(expectedHeader, header.getBytes(StandardCharsets.UTF_8));
        if (valid) {
            chain.doFilter(request, response);
            return;
        }
        response.setHeader("WWW-Authenticate", "Basic realm=\"Mis Gastos\", charset=\"UTF-8\"");
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
    }
}
