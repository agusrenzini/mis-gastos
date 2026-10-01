package com.misgastos.dto;

/** Contraseña temporal generada al restablecer. Se muestra una sola vez y no se guarda en texto. */
public record TemporaryPasswordResponse(String username, String temporaryPassword) {
}
