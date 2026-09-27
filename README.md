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
| `APP_PASSWORD` | — | Opcional. Si tiene valor, la app pide usuario y contraseña. **Usala al publicar.** |
| `APP_USERNAME` | `yo` | Usuario para `APP_PASSWORD` (por defecto `yo`) |
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
   - `APP_PASSWORD`: una clave larga, para que nadie más vea tus gastos
4. Render te da una URL con HTTPS, por ejemplo `https://mis-gastos.onrender.com`.

## 6. Instalar la app en el celular

1. Abrí la URL publicada en **Chrome** (Android).
2. Si configuraste `APP_PASSWORD`, ingresá el usuario (`yo`, salvo que cambies `APP_USERNAME`) y la contraseña.
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
│       └── config/                  zona horaria y contraseña opcional
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
