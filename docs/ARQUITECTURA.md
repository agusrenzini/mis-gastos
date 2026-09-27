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
| HTTP Basic opcional (`APP_PASSWORD`) | Es la protección mínima para un único usuario. Sin OAuth ni JWT. |

## Cómo agregar ingresos más adelante

El modelo está pensado para crecer sin rehacer nada:

1. **Base de datos:** nueva migración `V2__add_movement_type.sql`:
   ```sql
   ALTER TABLE expense ADD COLUMN type VARCHAR(10) NOT NULL DEFAULT 'EXPENSE';
   ALTER TABLE expense RENAME TO movement;  -- opcional, si se quiere un nombre más general
   ```
   Los gastos existentes quedan como `EXPENSE` automáticamente.
2. **Backend:** agregar `enum MovementType { EXPENSE, INCOME }` y el campo `type` en la entidad y los DTOs. Las categorías de ingreso (SUELDO, FREELANCE…) pueden ser otro enum o una columna `category` compartida con validación por tipo.
3. **Estadísticas:** `StatisticsService` filtra por `type` y calcula `balance = ingresos - gastos`.
4. **Frontend:** en `expense-form.js`, un selector Gasto/Ingreso. En `expenseRow()` (`ui.js`), mostrar los ingresos en verde con `+`, como indica el design system. El parser puede detectar "cobré", "me pagaron" o "ingresó".

La API sigue siendo compatible: si `type` no llega, se asume `EXPENSE`.

## Offline

Hoy el service worker guarda **la interfaz** (HTML, CSS, JS e íconos), así que la app abre sin conexión. **Los gastos no se guardan offline:** si no hay conexión, el formulario muestra el error y conserva los datos para reintentar.

Para una versión futura con carga offline:

1. `IndexedDB` como cola de gastos pendientes (`offline-queue.js`).
2. `api.createExpense` encola si falla por falta de conexión y la interfaz muestra "pendiente de sincronizar".
3. Al volver la conexión (evento `online` o Background Sync), se envía la cola.
4. Un `clientId` (UUID) por gasto evita duplicados si un envío se reintenta.

## Fuera del MVP (versiones futuras)

- Ingresos y balance
- Presupuestos por categoría y "¿cuánto puedo gastar por día hasta fin de mes?"
- Gastos recurrentes y suscripciones automáticas
- Tarjetas con fecha de cierre y vencimiento, y cuotas
- Análisis por comercio (campo `merchant`)
- Preguntas en lenguaje natural ("¿cuánto gasté en Uber este año?") con IA
- Parser de voz con IA (reemplazando `parseExpense`)
- OCR de tickets
- Conexión con Mercado Pago o bancos
- Notificaciones
- Multiusuario y login con Google
- Sincronización offline completa
