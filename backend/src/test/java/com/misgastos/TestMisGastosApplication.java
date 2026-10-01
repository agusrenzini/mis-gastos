package com.misgastos;

import org.springframework.boot.SpringApplication;

/**
 * Levanta la app completa con una base H2 en memoria, para probar sin tocar PostgreSQL.
 * Uso (sin pasar perfiles):  mvn spring-boot:test-run
 * Activa solo el perfil "test". Si además se activa "dev", IsolatedDatabaseGuard frena el arranque,
 * porque dev apuntaría a la base de backend/.env. Los datos se pierden al cerrar.
 */
public class TestMisGastosApplication {

    public static void main(String[] args) {
        SpringApplication.from(MisGastosApplication::main)
                .withAdditionalProfiles("test")
                .run(args);
    }
}
