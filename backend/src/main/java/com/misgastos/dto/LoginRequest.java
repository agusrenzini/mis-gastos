package com.misgastos.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record LoginRequest(
        @NotBlank(message = "Ingresá tu usuario")
        @Size(max = 100, message = "Usuario o contraseña incorrectos")
        String username,

        @NotBlank(message = "Ingresá tu contraseña")
        @Size(max = 200, message = "Usuario o contraseña incorrectos")
        String password
) {
}
