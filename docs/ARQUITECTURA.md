# Arquitectura y decisiones

## Recorrido de un gasto por voz

```
[Pantalla Voz]  screens/voice.js
      │ usa
      ▼
SpeechRecognitionService   (voice/speech-recognition-service.js)
      │ texto: "Gasté 18 lucas en una cena ayer"
      ▼
parseExpense()             (voice/expense-parser.js)
      │ { amount: 18000, category: 'COMIDA', description: 'Cena', date: '2026-09-25', ... }
      ▼
[Pantalla Confirmación]    screens/expense-form.js (modo "voice")  ← el usuario corrige
      │ "Guardar gasto"
      ▼
api.createExpense()        (api.js)  →  POST /api/expenses
      ▼
ExpenseController → ExpenseService → ExpenseRepository → PostgreSQL
```

**Nunca se guarda sin confirmar.** El borrador vive solo en memoria (`state.js`).

## Decisiones importantes

| Decisión | Por qué |
|---|---|
| El parser de voz está en el frontend (JS) | La voz se transcribe en el navegador. Interpretarla ahí da una confirmación instantánea y no depende del servidor. Tiene tests con `node --test`. |
| El reconocimiento y el parser son módulos separados | Se puede cambiar el motor de voz (por ejemplo, una API de transcripción) sin tocar el parser, y el parser por una IA sin tocar la pantalla. Los dos devuelven siempre el mismo objeto. |
| Spring Boot sirve el frontend | Una sola URL con HTTPS: la PWA y el micrófono lo necesitan. No hace falta CORS y hay un solo servicio para desplegar. |
| `BigDecimal` / `NUMERIC(12,2)` para dinero | `double` produce errores de redondeo (0.1 + 0.2 ≠ 0.3). |
| `LocalDate` para la fecha del gasto e `Instant` (UTC) para `createdAt` | La fecha del gasto es un día de calendario elegido por el usuario. `createdAt` es un instante exacto y se muestra en la hora del teléfono. |
| `Clock` con zona `America/Argentina/Buenos_Aires` | Los servidores suelen estar en UTC: a las 22:00 en Argentina ya es "mañana" en UTC. |
| Flyway para el esquema | Los cambios en la base quedan versionados en archivos SQL. Hibernate solo valida (`ddl-auto=validate`). |
| Estadísticas calculadas en Java | Con los datos de una persona alcanza con sumar en memoria, y el código es fácil de leer y testear. Si crecen mucho, se pasan a consultas SQL con `GROUP BY` sin cambiar la API. |
| Hash routing (`#/inicio`) | Funciona sin configurar el servidor y con la PWA offline. |
| Sin frameworks ni librerías en el frontend | Los gráficos son SVG y HTML hechos a mano; el JS completo pesa pocos KB. |
| Cuentas con Spring Security: sesión en cookie HttpOnly + cookie "recordarme" firmada | Sin JWT: la sesión vive en el servidor y se puede cortar al instante. La cookie "recordarme" mantiene la sesión en el celular aunque Render reinicie el servidor, y deja de valer si cambia la contraseña. |
| Cada consulta de gastos filtra por `user_id` | El repositorio solo expone métodos `...ByUserId...`; un id de otro usuario responde 404, igual que uno inexistente. |
| `ActiveUserFilter` relee al usuario en cada pedido a `/api` | Desactivar una cuenta, restablecer su contraseña o cambiarle el rol tiene efecto inmediato, aunque tenga la sesión abierta. Es una consulta por pedido: alcanza para este volumen. |
| CSRF con cookie `XSRF-TOKEN` + header | La sesión viaja en una cookie, así que hace falta. `api.js` copia el token en cada cambio. |
| Rol ADMIN solo por SQL | Ningún endpoint puede crear administradores: no hay forma de escalar permisos desde la app. |
| Límite de intentos en memoria | Hay una sola instancia del servidor. Con varias, pasaría a la base o a Redis. |

## Ingresos, gastos fijos y presupuesto

Tablas (migraciones V3 a V5), todas con `user_id` y montos `NUMERIC(12,2)`:

| Tabla | Qué guarda |
|---|---|
| `income` | Ingresos. `status` = `EXPECTED` (para planificar) o `RECEIVED` (dinero ingresado). Cobrar un esperado cambia el estado del **mismo** registro: nunca se duplica. |
| `recurring_expense` | La configuración de un gasto fijo: concepto, categoría, importe previsto, día de vencimiento, mes de inicio y fin opcional, `ACTIVE`/`PAUSED`. |
| `recurring_obligation` | Lo que hay que pagar de un gasto fijo en un mes: `PENDING`, `PAID` (con `expense_id`) o `SKIPPED`. Copia concepto, categoría e importe al generarse. |
| `budget_item` | Importe asignado a una categoría en un mes. Es un plan: no registra gastos. |

**Generación de obligaciones.** No hay proceso programado: cada vez que se consulta un mes (Plan, gastos fijos, presupuesto) se crean las obligaciones que falten hasta ese mes con `INSERT … ON CONFLICT DO NOTHING`. Funciona aunque Render haya estado suspendido y es idempotente. La base lo garantiza con `UNIQUE (recurring_id, obligation_month)`.

**Pagos sin duplicar.**
- Pagar crea un gasto real con la misma lógica que la carga manual (`ExpenseService.create`) y lo vincula. Vincular usa un gasto que ya existía.
- `UNIQUE (expense_id)`: un gasto paga como máximo una obligación.
- `CHECK ((status = 'PAID') = (expense_id IS NOT NULL))`: no hay pagadas sin gasto.
- La obligación se bloquea (`SELECT … FOR UPDATE`) mientras se paga: dos pagos simultáneos no pueden pasar los dos.
- Si se elimina el gasto con el que se pagó, el mes vuelve a pendiente. "Deshacer pago" elimina el gasto solo si lo creó la app.

**Historial.**
- Los meses pagados nunca cambian.
- Editar la configuración actualiza solo los meses pendientes desde el actual, sin pisar importes ajustados a mano.
- Pausar o finalizar borra solo los meses futuros no pagados (eran una proyección).
- Al reanudar, se sigue desde el mes actual (`generate_from`): no se generan los meses en que estuvo pausado.
- Un gasto fijo con meses pagados no se puede eliminar; se finaliza.
- Si el día de vencimiento no existe en el mes (31 en abril), vence el último día.

**Cálculos del mes** (`BudgetService.calculate`):
- Restante por categoría = presupuesto − gastos reales − fijos pendientes. Al pagar un fijo deja de estar pendiente y pasa a gasto real: se descuenta una sola vez.
- Ingresos planificados = recibidos + esperados (cada ingreso cuenta una vez, según su estado).
- Balance registrado = recibidos − gastos reales. Balance después de pendientes = balance registrado − fijos pendientes. No son el saldo de la cuenta: no se conoce el saldo inicial.
- Si el presupuesto total supera los ingresos planificados, la app avisa pero deja guardar.

## Offline

Hoy el service worker guarda **la interfaz** (HTML, CSS, JS e íconos), así que la app abre sin conexión. **Los gastos no se guardan offline:** si no hay conexión, el formulario muestra el error y conserva los datos para reintentar.

Para una versión futura con carga offline:

1. `IndexedDB` como cola de gastos pendientes (`offline-queue.js`).
2. `api.createExpense` encola si falla por falta de conexión y la interfaz muestra "pendiente de sincronizar".
3. Al volver la conexión (evento `online` o Background Sync), se envía la cola.
4. Un `clientId` (UUID) por gasto evita duplicados si un envío se reintenta.

## Fuera del MVP (versiones futuras)

- "¿Cuánto puedo gastar por día hasta fin de mes?"
- Tarjetas con fecha de cierre y vencimiento, y cuotas
- Análisis por comercio (campo `merchant`)
- Preguntas en lenguaje natural ("¿cuánto gasté en Uber este año?") con IA
- Parser de voz con IA (reemplazando `parseExpense`)
- OCR de tickets
- Conexión con Mercado Pago o bancos
- Notificaciones
- Login con Google
- Sincronización offline completa
