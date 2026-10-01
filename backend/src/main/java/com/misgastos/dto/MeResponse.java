package com.misgastos.dto;

import com.misgastos.model.Role;
import com.misgastos.security.AppUserPrincipal;

/** Datos de la sesión actual para el frontend. Nunca incluye la contraseña ni su hash. */
public record MeResponse(String username, Role role, boolean mustChangePassword) {

    public static MeResponse from(AppUserPrincipal user) {
        return new MeResponse(user.username(), user.role(), user.mustChangePassword());
    }
}
