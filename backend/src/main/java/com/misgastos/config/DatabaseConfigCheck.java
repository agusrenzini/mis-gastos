package com.misgastos.config;

import org.springframework.boot.context.event.ApplicationEnvironmentPreparedEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.core.env.ConfigurableEnvironment;

/**
 * Antes de conectarse a PostgreSQL, verifica que la contraseña esté configurada.
 * Sin esto, el error es un "la autentificación password falló" difícil de entender.
 */
public class DatabaseConfigCheck implements ApplicationListener<ApplicationEnvironmentPreparedEvent> {

    @Override
    public void onApplicationEvent(ApplicationEnvironmentPreparedEvent event) {
        ConfigurableEnvironment env = event.getEnvironment();
        String url = env.getProperty("DATABASE_URL", "jdbc:postgresql://localhost:5432/mis_gastos");
        if (!url.startsWith("jdbc:postgresql:")) {
            return;
        }
        String password = env.getProperty("DB_PASSWORD");
        if (password == null || password.isBlank()) {
            // Mensaje sin acentos: la consola de Windows no siempre los muestra bien.
            throw new IllegalStateException("""

                    Falta DB_PASSWORD (la clave de PostgreSQL).
                    Para crear la base y el archivo backend\\.env, desde la carpeta mis-gastos ejecutar:
                        powershell -ExecutionPolicy Bypass -File scripts\\crear-base.ps1
                    O definir DB_PASSWORD como variable de entorno (ver README).
                    """);
        }
    }
}
