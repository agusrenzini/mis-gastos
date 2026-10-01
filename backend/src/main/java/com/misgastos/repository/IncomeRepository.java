package com.misgastos.repository;

import com.misgastos.model.Income;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/** Todas las consultas filtran por userId: un usuario nunca ve ingresos de otro. */
public interface IncomeRepository extends JpaRepository<Income, Long> {

    Optional<Income> findByIdAndUserId(Long id, Long userId);

    List<Income> findByUserIdAndDateBetweenOrderByDateDescCreatedAtDesc(Long userId, LocalDate from, LocalDate to);
}
