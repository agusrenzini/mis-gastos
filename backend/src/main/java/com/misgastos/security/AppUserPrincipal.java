package com.misgastos.security;

import com.misgastos.model.AppUser;
import com.misgastos.model.Role;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;

/**
 * El usuario con sesión iniciada, tal como lo ve Spring Security.
 * Los controladores lo reciben con @AuthenticationPrincipal y usan id() para filtrar los datos.
 * passwordHash y sessionVersion se usan solo para firmar la cookie "recordarme": si cambia la contraseña
 * o se cierra sesión (sessionVersion + 1), las cookies anteriores dejan de valer.
 */
public record AppUserPrincipal(Long id, String username, String passwordHash, Role role,
                               boolean active, boolean mustChangePassword, int sessionVersion) implements UserDetails {

    public static AppUserPrincipal from(AppUser user) {
        return new AppUserPrincipal(user.getId(), user.getUsername(), user.getPasswordHash(), user.getRole(),
                user.isActive(), user.isMustChangePassword(), user.getSessionVersion());
    }

    public boolean isAdmin() {
        return role == Role.ADMIN;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));
    }

    /**
     * Lo que firma la cookie "recordarme". Con versión 0 es solo el hash, así las cookies emitidas
     * antes de existir sessionVersion siguen siendo válidas.
     */
    @Override
    public String getPassword() {
        return sessionVersion == 0 ? passwordHash : passwordHash + ":" + sessionVersion;
    }

    @Override
    public String getUsername() {
        return username;
    }

    @Override
    public boolean isEnabled() {
        return active;
    }

    /** Nunca imprimir el hash en logs. */
    @Override
    public String toString() {
        return "AppUserPrincipal[id=" + id + ", username=" + username + ", role=" + role + "]";
    }
}
