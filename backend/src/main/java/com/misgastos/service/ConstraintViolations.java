package com.misgastos.service;

import org.hibernate.exception.ConstraintViolationException;

import java.util.Locale;

/**
 * Distingue qué restricción de la base falló. Así un "ya está en uso" se muestra solo cuando
 * de verdad hay un duplicado, y cualquier otro error (de la base o del servidor) no se disfraza.
 */
final class ConstraintViolations {

    private ConstraintViolations() {
    }

    /** true si la causa es la violación de la restricción con ese nombre (sin importar mayúsculas). */
    static boolean isViolationOf(Throwable error, String constraintName) {
        for (Throwable t = error; t != null; t = t.getCause()) {
            if (t instanceof ConstraintViolationException violation) {
                String name = violation.getConstraintName();
                return name != null && name.toLowerCase(Locale.ROOT).contains(constraintName.toLowerCase(Locale.ROOT));
            }
        }
        return false;
    }
}
