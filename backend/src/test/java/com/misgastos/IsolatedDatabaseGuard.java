package com.misgastos;

import org.springframework.boot.EnvironmentPostProcessor;
import org.springframework.boot.SpringApplication;
import org.springframework.core.env.ConfigurableEnvironment;

/**
 * Red de seguridad para los tests: cualquier aplicación que arranque con el classpath de tests
 * (mvn test, o mvn spring-boot:test-run) tiene que usar H2. Si la configuración apunta a
 * PostgreSQL (por ejemplo, porque se activó el perfil "dev", que toma los datos de backend/.env),
 * corta el arranque ANTES de conectarse, así nunca se tocan los datos de desarrollo o producción.
 *
 * Se registra en src/test/resources/META-INF/spring.factories, que solo existe en el classpath de tests.
 */
public class IsolatedDatabaseGuard implements EnvironmentPostProcessor {

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        String url = environment.getProperty("spring.datasource.url", "");
        if (!url.startsWith("jdbc:h2:")) {
            throw new IllegalStateException("""

                    Los tests tienen que usar una base H2 aislada, pero la URL es: %s
                    Usa solo el perfil "test" (no "test,dev": dev toma la base de backend/.env).
                    """.formatted(url.replaceAll("password=[^;&]*", "password=***")));
        }
    }
}
