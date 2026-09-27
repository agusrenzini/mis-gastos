package com.misgastos;

import org.springframework.boot.SpringApplication;

/**
 * Levanta la app completa con la base H2 en memoria (sin PostgreSQL), para probar rápido.
 * Uso: mvn spring-boot:test-run "-Dspring-boot.run.profiles=test,dev"
 * Los datos se pierden al cerrar.
 */
public class TestMisGastosApplication {

    public static void main(String[] args) {
        SpringApplication.from(MisGastosApplication::main).run(args);
    }
}
