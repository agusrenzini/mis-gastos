-- Versión de las sesiones "recordarme" de cada usuario. Al cerrar sesión se incrementa,
-- así una cookie "recordarme" anterior (aunque alguien la haya copiado) deja de valer.
-- Los usuarios existentes quedan en 0: sus cookies actuales siguen funcionando.
ALTER TABLE app_user ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0;
