package com.misgastos.security;

import com.misgastos.repository.AppUserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.security.web.authentication.logout.HttpStatusReturningLogoutSuccessHandler;
import org.springframework.security.web.authentication.rememberme.TokenBasedRememberMeServices;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.util.Base64;

/**
 * Seguridad de la API:
 *  - /api/auth/login y /api/auth/register son públicos (con límite de intentos).
 *  - /api/admin/** solo para el rol ADMIN.
 *  - El resto de /api/** requiere sesión iniciada.
 *  - Los archivos del frontend son públicos: la pantalla de login tiene que poder cargarse.
 * La sesión se guarda en una cookie HttpOnly y, además, una cookie "recordarme" firmada
 * mantiene la sesión abierta en el celular aunque el servidor se reinicie.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private static final Logger log = LoggerFactory.getLogger(SecurityConfig.class);
    private static final int REMEMBER_ME_DAYS = 60;

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, TokenBasedRememberMeServices rememberMeServices,
                                            AppUserRepository users) {
        http
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/login", "/api/auth/register").permitAll()
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .requestMatchers("/api/**").authenticated()
                        .anyRequest().permitAll())
                // El frontend lee la cookie XSRF-TOKEN y la manda en el header X-XSRF-TOKEN.
                .csrf(csrf -> csrf.spa())
                .addFilterAfter(new CsrfCookieFilter(), CsrfFilter.class)
                .rememberMe(remember -> remember.rememberMeServices(rememberMeServices))
                .addFilterBefore(new ActiveUserFilter(users, rememberMeServices), AuthorizationFilter.class)
                .logout(logout -> logout
                        .logoutUrl("/api/auth/logout")
                        .logoutSuccessHandler(new HttpStatusReturningLogoutSuccessHandler(HttpStatus.NO_CONTENT)))
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, ex) ->
                                JsonErrors.write(response, HttpServletResponse.SC_UNAUTHORIZED, JsonErrors.LOGIN_REQUIRED))
                        .accessDeniedHandler((request, response, ex) ->
                                JsonErrors.write(response, HttpServletResponse.SC_FORBIDDEN, JsonErrors.FORBIDDEN)))
                .httpBasic(basic -> basic.disable())
                .formLogin(form -> form.disable());
        return http.build();
    }

    /** BCrypt (con prefijo {bcrypt}, así se puede cambiar de algoritmo en el futuro). */
    @Bean
    PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }

    @Bean
    SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    /**
     * Cookie "recordarme": firmada con REMEMBER_ME_KEY y con el hash de la contraseña,
     * así que deja de valer si se cambia la contraseña o se desactiva la cuenta.
     */
    @Bean
    TokenBasedRememberMeServices rememberMeServices(@Value("${app.auth.remember-me-key}") String key,
                                                    AppUserDetailsService userDetailsService) {
        if (key.isBlank()) {
            log.warn("REMEMBER_ME_KEY no está configurada: las sesiones se cerrarán cada vez que se reinicie el servidor.");
            byte[] random = new byte[32];
            new SecureRandom().nextBytes(random);
            key = Base64.getEncoder().encodeToString(random);
        }
        TokenBasedRememberMeServices services = new TokenBasedRememberMeServices(key, userDetailsService);
        services.setAlwaysRemember(true);
        services.setTokenValiditySeconds((int) Duration.ofDays(REMEMBER_ME_DAYS).toSeconds());
        services.setCookieCustomizer(cookie -> cookie.setAttribute("SameSite", "Lax"));
        return services;
    }

    /** Límites de intentos fallidos de login: por usuario y por IP, en 15 minutos. */
    @Bean
    LoginLimiters loginLimiters(Clock clock) {
        Duration window = Duration.ofMinutes(15);
        return new LoginLimiters(
                new AttemptLimiter(10, window, clock),
                new AttemptLimiter(30, window, clock),
                new AttemptLimiter(10, Duration.ofHours(1), clock));
    }

    /** Agrupa los tres limitadores para inyectarlos juntos. */
    public record LoginLimiters(AttemptLimiter loginByUsername, AttemptLimiter loginByIp,
                                AttemptLimiter registerByIp) {
        public void clear() {
            loginByUsername.clear();
            loginByIp.clear();
            registerByIp.clear();
        }
    }

    /** Fuerza a generar la cookie XSRF-TOKEN en cada respuesta, para que el frontend la tenga desde el inicio. */
    static final class CsrfCookieFilter extends OncePerRequestFilter {
        @Override
        protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
                throws ServletException, IOException {
            CsrfToken token = (CsrfToken) request.getAttribute(CsrfToken.class.getName());
            if (token != null) {
                token.getToken();
            }
            chain.doFilter(request, response);
        }
    }
}
