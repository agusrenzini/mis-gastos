package com.misgastos.repository;

import com.misgastos.model.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface AppUserRepository extends JpaRepository<AppUser, Long> {

    Optional<AppUser> findByUsername(String username);

    boolean existsByUsername(String username);

    List<AppUser> findAllByOrderByCreatedAtAsc();

    /** Invalida las cookies "recordarme" del usuario (ver AppUserPrincipal.getPassword). */
    @Modifying
    @Transactional
    @Query("update AppUser u set u.sessionVersion = u.sessionVersion + 1 where u.id = :id")
    int incrementSessionVersion(@Param("id") Long id);
}
