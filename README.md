# Mis Gastos

App personal para registrar gastos **por voz o a mano en menos de 10 segundos**, y ver cuánto gastaste por semana, mes, año y categoría.

- **Frontend:** HTML + CSS + JavaScript sin frameworks. Es una PWA que se instala en el celular.
- **Backend:** Java 21 + Spring Boot 4 (API REST).
- **Base de datos:** PostgreSQL.
- **Diseño:** "Serene Mint", generado con Stitch. La referencia está en `design-reference/`.

```
Navegador (frontend/)  ──JSON──►  Spring Boot (backend/)  ──JPA──►  PostgreSQL
```

En desarrollo y en producción, **Spring Boot sirve también el frontend**: hay una sola URL y no hace falta configurar CORS.

---

## 1. Requisitos

| Herramienta | Versión | Para qué | ¿Cómo verifico? |
|---|---|---|---|
| Java (JDK) | 21 o más nuevo | Ejecutar el backend | `java -version` |
| Maven | 3.9+ | Compilar y correr el backend | `mvn -v` |
| PostgreSQL | 14+ | Guardar los gastos | Servicio `postgresql-x64-17` en Windows |
| Navegador | Chrome recomendado | Usar la app (la voz funciona mejor en Chrome) | — |
| Node.js | 18+ (opcional) | Solo para correr los tests del parser de voz | `node -v` |

---

## 2. Configurar PostgreSQL (una sola vez)

Desde la carpeta `mis-gastos`, en PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\crear-base.ps1
```

El script:

1. te pide la contraseña del usuario `postgres`, la que elegiste al instalar PostgreSQL;
2. crea el usuario `mis_gastos` con una contraseña aleatoria;
3. crea la base `mis_gastos`;
4. guarda la conexión en `backend\.env`. Ese archivo **no se sube a git**.

Las tablas no se crean a mano: las crea **Flyway** automáticamente al arrancar la app, a partir de `backend/src/main/resources/db/migration/`.

<details>
<summary>Prefiero hacerlo a mano</summary>

```sql
-- en psql o pgAdmin, conectado como postgres
CREATE ROLE mis_gastos LOGIN PASSWORD 'una-clave';
CREATE DATABASE mis_gastos OWNER mis_gastos;
```

Después copiá `backend/.env.example` como `backend/.env` y completá `DB_PASSWORD`.
</details>

### Variables de entorno

| Variable | Ejemplo | Descripción |
|---|---|---|
| `DATABASE_URL` | `jdbc:postgresql://localhost:5432/mis_gastos` | URL JDBC de la base |
| `DB_USERNAME` | `mis_gastos` | Usuario de la base |
| `DB_PASSWORD` | — | Contraseña de la base |
| `REMEMBER_ME_KEY` | — | Clave secreta larga para que la sesión quede abierta en el celular aunque el servidor se reinicie. **Usala al publicar.** Sin ella, hay que volver a ingresar después de cada reinicio |
| `SPRING_PROFILES_ACTIVE` | `prod` | En producción. En tu PC se usa `dev` automáticamente |
| `PORT` | `8080` | Puerto (los hostings lo definen solos) |

Se pueden definir en `backend/.env` (lo más simple; lo crea `crear-base.ps1`) o como variables de usuario de Windows. Si están en los dos lugares, gana la variable de Windows.

<details>
<summary>Definirlas como variables de Windows</summary>

En PowerShell (quedan guardadas para tu usuario; cerrá y abrí la terminal y VS Code para que se apliquen):

```powershell
[Environment]::SetEnvironmentVariable('DATABASE_URL', 'jdbc:postgresql://localhost:5432/mis_gastos', 'User')
[Environment]::SetEnvironmentVariable('DB_USERNAME', 'mis_gastos', 'User')
[Environment]::SetEnvironmentVariable('DB_PASSWORD', 'tu-clave', 'User')
```

O con la interfaz: *Inicio* → "Editar las variables de entorno de esta cuenta" → *Nueva…*
</details>

---

## 3. Levantar la app

```powershell
cd backend
mvn spring-boot:run "-Dspring-boot.run.profiles=dev"
```

(`dev` es el perfil por defecto, así que `mvn spring-boot:run` solo hace lo mismo.)

Abrí **http://localhost:8080** en el navegador. Eso es todo: el backend sirve el frontend.

- Los gastos se guardan en PostgreSQL: **siguen ahí después de cerrar y volver a abrir la app.**
- Si editás un archivo de `frontend/`, alcanza con recargar la página, sin reiniciar.
- Si editás código Java, frená el servidor con `Ctrl+C` y volvé a correr el comando.
- Para confirmar que usa PostgreSQL, buscá en el log: `Database: jdbc:postgresql://localhost:5432/mis_gastos (PostgreSQL 17...)`.

> La base H2 en memoria (`jdbc:h2:mem:misgastos`) se usa **solo en `mvn test`**. No corras la app con el perfil `test`: los datos se borrarían al cerrarla.

### Probar la app en el celular estando en tu PC

El micrófono y la instalación como app **solo funcionan con HTTPS o en `localhost`**. Para probar desde el celular antes de publicar, conectalo por USB y usá el reenvío de puertos de Chrome:

1. En el celular: activá *Opciones de desarrollador* → *Depuración por USB*.
2. En la PC, en Chrome: abrí `chrome://inspect/#devices` → *Port forwarding* → `8080` → `localhost:8080`.
3. En el Chrome del celular: abrí `http://localhost:8080`.

---

## 4. Tests

```powershell
# Backend: API, validaciones y estadísticas (usa una base en memoria, no toca tus datos)
cd backend
mvn test

# Parser de voz: "18 lucas", "35.500", "ayer", etc.
cd frontend
node --test
```

---

## 5. Publicar en internet

Necesitás un hosting para la app y una base PostgreSQL en la nube. Una combinación gratuita o barata:

1. **Base de datos:** creá un proyecto en [Neon](https://neon.tech) o [Supabase](https://supabase.com) y copiá los datos de conexión.
2. **App:** en [Render](https://render.com), creá un *Web Service* desde tu repositorio de GitHub. Render detecta el `Dockerfile` solo.
3. En Render, cargá las variables de entorno:
   - `DATABASE_URL` en formato JDBC: `jdbc:postgresql://HOST:5432/BASE?sslmode=require`. Ojo: debe empezar con `jdbc:postgresql://`, no con `postgres://`.
   - `DB_USERNAME` y `DB_PASSWORD`
   - `REMEMBER_ME_KEY`: una clave larga al azar (generala en PowerShell con `$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)`). No la cambies después: si cambia, todos tienen que volver a ingresar.
4. Render te da una URL con HTTPS, por ejemplo `https://mis-gastos.onrender.com`.
5. La primera vez, registrá tu cuenta y habilitala como administradora (ver [Cuentas y administración](#8-cuentas-y-administración)).

## 6. Instalar la app en el celular

1. Abrí la URL publicada en **Chrome** (Android).
2. Ingresá con tu usuario y contraseña, o creá una cuenta con **Creá una**.
3. Menú **⋮** → **Instalar app** o **Agregar a pantalla principal**. También podés instalarla desde **Ajustes** dentro de la app.
4. Aparece el ícono de Mis Gastos y la app se abre a pantalla completa, sin la barra del navegador.

En iPhone: Safari → botón Compartir → **Agregar a inicio**. En iOS el reconocimiento de voz es más limitado; si no anda, podés escribir la frase ("10 lucas de nafta") en la misma pantalla.

---

## 7. Estructura del proyecto

```
mis-gastos/
├── backend/                         Spring Boot
│   ├── pom.xml                      dependencias; también copia frontend/ dentro del jar
│   └── src/main/java/com/misgastos/
│       ├── controller/              reciben HTTP y devuelven JSON
│       ├── service/                 lógica: guardar gastos, calcular estadísticas
│       ├── repository/              consultas a la base (Spring Data JPA)
│       ├── model/                   entidad Expense y enums (Category, PaymentMethod…)
│       ├── dto/                     forma exacta de lo que entra y sale de la API
│       ├── security/                login, sesiones, permisos y límite de intentos
│       └── config/                  zona horaria
├── frontend/
│   ├── index.html                   única página; las pantallas se dibujan con JS
│   ├── manifest.json                datos de la PWA (nombre, íconos, colores)
│   ├── service-worker.js            permite abrir la interfaz sin conexión
│   ├── css/                         tokens.css (colores, radios) → base → components → screens
│   ├── js/
│   │   ├── app.js                   navegación entre pantallas (#/inicio, #/voz…)
│   │   ├── api.js                   todas las llamadas al backend
│   │   ├── screens/                 una pantalla por archivo
│   │   └── voice/                   reconocimiento de voz + parser de frases
│   └── tests/                       tests del parser de voz
├── design-reference/                export de Stitch (solo referencia)
├── docs/ARQUITECTURA.md             decisiones de diseño y cómo evolucionar
├── scripts/crear-base.ps1           crea la base local
└── Dockerfile                       para publicar
```

### API

| Método | Ruta | Qué hace |
|---|---|---|
| `POST` | `/api/expenses` | Crea un gasto |
| `GET` | `/api/expenses?from=2026-09-01&to=2026-09-30` | Lista gastos (las fechas son opcionales) |
| `GET` | `/api/expenses/{id}` | Un gasto |
| `PUT` | `/api/expenses/{id}` | Modifica un gasto |
| `DELETE` | `/api/expenses/{id}` | Elimina un gasto |
| `GET` | `/api/dashboard?month=2026-09` | Resumen para Inicio |
| `GET` | `/api/statistics?period=MONTH&date=2026-09-26` | Estadísticas: `WEEK`, `MONTH` o `YEAR` |
| `POST` | `/api/auth/register` | Crea una cuenta común e inicia sesión |
| `POST` | `/api/auth/login` | Inicia sesión |
| `POST` | `/api/auth/logout` | Cierra la sesión |
| `GET` | `/api/auth/me` | Usuario con sesión iniciada |
| `POST` | `/api/auth/change-password` | Cambia la contraseña propia |
| `GET` | `/api/admin/users` | **Admin.** Usuarios con fecha de registro y resumen de actividad |
| `POST` | `/api/admin/users/{id}/deactivate` · `/activate` | **Admin.** Desactiva o reactiva una cuenta |
| `POST` | `/api/admin/users/{id}/reset-password` | **Admin.** Genera una contraseña temporal |
| `GET` · `POST` | `/api/admin/unassigned-expenses` · `/assign-to-me` | **Admin.** Gastos anteriores a las cuentas |

Todas las rutas, salvo registro e inicio de sesión, requieren sesión iniciada. Cada usuario solo ve y modifica sus propios gastos: pedir el gasto de otro por su id responde 404. Los `POST`/`PUT`/`DELETE` llevan el header `X-XSRF-TOKEN` con el valor de la cookie `XSRF-TOKEN` (protección CSRF; `api.js` lo hace solo).

Ejemplo de gasto:

```json
{
  "amount": 18000,
  "description": "Cena",
  "date": "2026-09-25",
  "category": "COMIDA",
  "paymentMethod": "EFECTIVO",
  "source": "VOICE",
  "voiceTranscript": "Gasté 18 mil pesos en una cena ayer"
}
```

Más detalles sobre las decisiones y la evolución prevista en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

---

## 8. Cuentas y administración

- **Registro:** solo usuario (3 a 30 letras, números, `.`, `-` o `_`; mayúsculas y minúsculas son lo mismo) y contraseña (mínimo 6 caracteres). Sin correo ni verificación.
- Las contraseñas se guardan con **BCrypt**: ni la base ni el panel permiten verlas.
- **Límite de intentos:** 10 intentos fallidos de login por usuario o 30 por IP cada 15 minutos, y 10 registros por IP por hora. Al pasarlo, hay que esperar unos minutos.
- La sesión queda abierta 60 días en cada dispositivo (cookie "recordarme").
- Toda cuenta nueva es **común**. Nadie puede registrarse como administradora.

### Habilitar tu cuenta como administradora (una sola vez)

1. Abrí la app y **registrá tu cuenta** normalmente (por ejemplo, `agus`).
2. Entrá a la base y ejecutá, con tu usuario:
   ```sql
   UPDATE app_user SET role = 'ADMIN' WHERE username = 'agus';
   ```
   - **Neon:** en la consola de Neon, tu proyecto → **SQL Editor** → pegá la línea → **Run**.
   - **Local:** `psql -h localhost -U mis_gastos -d mis_gastos` y pegá la línea.
3. Recargá la app. En **Ajustes** aparece **Panel de administración** (no hace falta volver a ingresar).

Para quitarle el rol a alguien: `UPDATE app_user SET role = 'USER' WHERE username = '...';`

### Usar el panel (Ajustes → Panel de administración)

- **Usuarios:** cada cuenta con su fecha de registro, cantidad de gastos y fecha de la última carga. No muestra contraseñas ni el detalle de los gastos.
- **Desactivar / Reactivar:** una cuenta desactivada no puede entrar (si tenía la app abierta, se le cierra la sesión), pero sus gastos se conservan. Al reactivarla vuelve todo como estaba. No podés desactivar tu propia cuenta.
- **Restablecer contraseña** (cuando alguien te avisa que se la olvidó): genera una contraseña temporal del tipo `ab3k-x9mp-q2rt`, **que se muestra una sola vez**. Pasásela por un medio privado. La anterior deja de funcionar y se cierran sus sesiones abiertas. Al ingresar con la temporal, la app le pide elegir una nueva antes de seguir.
- **Gastos anteriores a las cuentas:** los gastos cargados antes de esta versión no tienen dueño y nadie los ve. El panel muestra cuántos son y de qué fechas. Con **Asignarlos a mi cuenta** pasan a ser tuyos.

