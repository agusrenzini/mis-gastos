package com.misgastos.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Registro: solo usuario y contraseña. No tiene campo de rol: los registros nuevos siempre son USER. */
public record RegisterRequest(
        @NotBlank(message = "Elegí un nombre de usuario")
        @Pattern(regexp = "^\s*[A-Za-z0-9._-]{3,30}\s*$",
                message = "Usá de 3 a 30 letras, números, punto, guion o guion bajo (sin espacios)")
        String username,

        @NotBlank(message = "Elegí una contraseña")
        @Size(min = 6, message = "La contraseña tiene que tener al menos 6 caracteres")
        @Size(max = 64, message = "La contraseña puede tener hasta 64 caracteres")
        String password,

        @NotBlank(message = "Repetí la contraseña")
        String confirmPassword
) {
}
