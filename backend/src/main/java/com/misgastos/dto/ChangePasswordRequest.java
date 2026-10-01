package com.misgastos.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChangePasswordRequest(
        @NotBlank(message = "Ingresá tu contraseña actual")
        String currentPassword,

        @NotBlank(message = "Elegí una contraseña nueva")
        @Size(min = 6, message = "La contraseña tiene que tener al menos 6 caracteres")
        @Size(max = 64, message = "La contraseña puede tener hasta 64 caracteres")
        String newPassword,

        @NotBlank(message = "Repetí la contraseña nueva")
        String confirmPassword
) {
}
