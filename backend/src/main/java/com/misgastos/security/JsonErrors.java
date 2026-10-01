package com.misgastos.security;

import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/** Respuestas de error de los filtros de seguridad, con el mismo formato que ApiError. */
final class JsonErrors {

    static final String LOGIN_REQUIRED = "Tenés que iniciar sesión.";
    static final String FORBIDDEN = "No tenés permiso para hacer esto.";
    static final String MUST_CHANGE_PASSWORD = "Antes de seguir, cambiá tu contraseña.";

    private JsonErrors() {
    }

    /** Los mensajes son constantes de esta clase: no hace falta escapar JSON. */
    static void write(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write("{\"message\":\"" + message + "\",\"errors\":{}}");
    }
}
