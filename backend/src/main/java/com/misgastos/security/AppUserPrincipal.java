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
 * passwordHash se usa solo para firmar la cookie "recordarme" y detectar cambios de contraseña.
 */
public record AppUserPrincipal(Long id, String username, String passwordHash, Role role,
                               boolean active, boolean mustChangePassword) implements UserDetails {

    public static AppUserPrincipal from(AppUser user) {
        return new AppUserPrincipal(user.getId(), user.getUsername(), user.getPasswordHash(), user.getRole(),
                user.isActive(), user.isMustChangePassword());
    }

    public boolean isAdmin() {
        return role == Role.ADMIN;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));
    }

    @Override
    public String getPassword() {
        return passwordHash;
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
