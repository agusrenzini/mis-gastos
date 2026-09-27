package com.misgastos.dto;

import java.util.Map;

/** Formato de todos los errores de la API: un mensaje legible y, si aplica, errores por campo. */
public record ApiError(String message, Map<String, String> errors) {

    public ApiError(String message) {
        this(message, Map.of());
    }
}
