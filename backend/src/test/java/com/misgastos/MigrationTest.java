package com.misgastos;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

import javax.sql.DataSource;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Las migraciones nuevas (V3 en adelante) no tocan los gastos ni los usuarios existentes.
 * Simula una base de producción en la versión 2 con datos, y la lleva a la última versión.
 * Usa su propia base H2 en memoria (no la de los demás tests, ni PostgreSQL).
 */
class MigrationTest {

    private static final String URL =
            "jdbc:h2:mem:migracion;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1";

    @Test
    void newMigrationsKeepExistingExpenses() throws Exception {
        // Una sola conexión para todo el test (como el pool de la app): H2 ata las restricciones CHECK
        // a la sesión que las creó, y si Flyway la cerrara, dejarían de poder evaluarse.
        try (Connection db = DriverManager.getConnection(URL, "sa", ""); Statement st = db.createStatement()) {
            DataSource single = new SingleConnectionDataSource(db, true);
            Flyway.configure().dataSource(single).target("2").load().migrate();

            try (PreparedStatement insert = db.prepareStatement(
                    "INSERT INTO app_user (username, password_hash, role, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)")) {
                insert.setString(1, "agus");
                insert.setString(2, "x");
                insert.setString(3, "ADMIN");
                insert.executeUpdate();
            }
            st.execute("""
                    INSERT INTO expense (amount, description, expense_date, category, payment_method, source,
                                         voice_transcript, created_at, updated_at, user_id) VALUES
                      (500.00, 'Farmacia', DATE '2026-09-26', 'SALUD', 'DEBITO', 'MANUAL', NULL,
                       TIMESTAMP '2026-09-26 22:20:36', TIMESTAMP '2026-09-26 22:20:36', NULL),
                      (18000.50, 'Cena', DATE '2026-09-25', 'COMIDA', 'EFECTIVO', 'VOICE', '18 lucas de cena',
                       TIMESTAMP '2026-09-25 21:00:00', TIMESTAMP '2026-09-25 21:00:00',
                       (SELECT id FROM app_user WHERE username = 'agus'))""");
            List<String> before = expenses(st);

            Flyway flyway = Flyway.configure().dataSource(single).load();
            flyway.migrate();

            assertThat(flyway.info().current().getVersion().getVersion()).isEqualTo("5");
            assertThat(expenses(st)).isEqualTo(before).hasSize(2);
            ResultSet users = st.executeQuery("SELECT username, role FROM app_user");
            assertThat(users.next()).isTrue();
            assertThat(users.getString(1)).isEqualTo("agus");
            assertThat(users.getString(2)).isEqualTo("ADMIN");
            for (String table : List.of("income", "recurring_expense", "recurring_obligation", "budget_item")) {
                ResultSet count = st.executeQuery("SELECT count(*) FROM " + table);
                count.next();
                assertThat(count.getInt(1)).as(table).isZero();
            }
        }
    }

    private static List<String> expenses(Statement st) throws Exception {
        List<String> rows = new ArrayList<>();
        try (ResultSet rs = st.executeQuery("SELECT * FROM expense ORDER BY id")) {
            int columns = rs.getMetaData().getColumnCount();
            while (rs.next()) {
                StringBuilder row = new StringBuilder();
                for (int i = 1; i <= columns; i++) {
                    row.append(rs.getMetaData().getColumnName(i)).append('=').append(rs.getString(i)).append(';');
                }
                rows.add(row.toString());
            }
        }
        return rows;
    }
}
