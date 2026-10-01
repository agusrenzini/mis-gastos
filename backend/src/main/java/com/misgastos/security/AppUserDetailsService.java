package com.misgastos.security;

import com.misgastos.repository.AppUserRepository;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.Locale;

/** Lo usa la cookie "recordarme" para volver a cargar al usuario cuando expira la sesión. */
@Service
public class AppUserDetailsService implements UserDetailsService {

    private final AppUserRepository users;

    public AppUserDetailsService(AppUserRepository users) {
        this.users = users;
    }

    @Override
    public UserDetails loadUserByUsername(String username) {
        return users.findByUsername(username.toLowerCase(Locale.ROOT))
                .map(AppUserPrincipal::from)
                .orElseThrow(() -> new UsernameNotFoundException("Usuario inexistente"));
    }
}
