package com.misgastos.service;

import org.springframework.http.HttpStatus;

import java.util.Map;

/** Error esperado (datos inválidos, usuario repetido, etc.) con el mensaje que ve el usuario. */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final Map<String, String> errors;

    public ApiException(HttpStatus status, String message) {
        this(status, message, Map.of());
    }

    public ApiException(HttpStatus status, String message, Map<String, String> errors) {
        super(message);
        this.status = status;
        this.errors = errors;
    }

    /** Error en un campo del formulario: se muestra debajo de ese campo. */
    public static ApiException field(HttpStatus status, String field, String message) {
        return new ApiException(status, message, Map.of(field, message));
    }

    public HttpStatus getStatus() { return status; }

    public Map<String, String> getErrors() { return errors; }
}
