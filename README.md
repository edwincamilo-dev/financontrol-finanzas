# FinanControl API

API REST en **Node.js + Express** para la **gestión de finanzas personales**: cada usuario registra sus ingresos y gastos, los organiza por categorías, los consulta por fechas y obtiene su saldo disponible y un resumen financiero. Usa autenticación **JWT** y base de datos **MySQL**, con **caché** en memoria, pruebas con **Jest** y **Supertest**, pruebas E2E con **Cypress** y un **contrato OpenAPI**.

> Saldo disponible = Total ingresos − Total gastos

## Requisitos previos

| Herramienta | Versión recomendada | Verificar con |
|---|---|---|
| [Node.js](https://nodejs.org/) | 20 o superior | `node -v` |
| npm | viene con Node.js | `npm -v` |
| [Git](https://git-scm.com/) | cualquiera reciente | `git --version` |
| [MySQL](https://dev.mysql.com/downloads/) | 8.x | `mysql --version` |

## 1. Descargar el proyecto

```bash
git clone https://github.com/edwincamilo-dev/financontrol-finanzas.git
cd financontrol-finanzas
```

> Si no tienes Git, en la página del repositorio pulsa **Code → Download ZIP**, descomprime y abre la terminal dentro de la carpeta.

## 2. Instalar dependencias

```bash
npm install
```

Esto crea la carpeta `node_modules/` (no se sube al repositorio, cada persona la genera). La primera instalación puede tardar porque Cypress descarga su propio programa.

## 3. Configurar la base de datos

Con MySQL encendido, ejecuta el script del proyecto. Crea la base `financontrol` y las tablas `usuarios`, `ingresos` y `gastos`:

```bash
mysql -u root -p < docs/schema.sql
```

> Si usas MySQL dentro de WSL (Ubuntu) y corres el proyecto desde Windows, enciéndelo antes con `sudo service mysql start`. WSL no lo enciende solo.

## 4. Configurar las variables de entorno

El archivo `.env` **no está en el repositorio** porque contiene datos privados. Crea el tuyo a partir de la plantilla:

**Windows (cmd):**
```cmd
copy .env.example .env
```

**Windows (PowerShell) / Mac / Linux / Git Bash:**
```bash
cp .env.example .env
```

Abre `.env` con un editor y completa los valores:

```env
DB_HOST=localhost
DB_USER=tu_usuario_mysql
DB_PASSWORD=tu_contraseña_mysql
DB_NAME=financontrol
DB_PORT=3306
JWT_SECRET=una_clave_secreta_larga_y_aleatoria
PORT=3000
```

| Variable | Descripción |
|---|---|
| `DB_HOST` | Servidor de MySQL (normalmente `localhost`) |
| `DB_USER` / `DB_PASSWORD` | Credenciales de tu MySQL |
| `DB_NAME` | Nombre de la base de datos creada en el paso 3 |
| `DB_PORT` | Puerto de MySQL (por defecto `3306`) |
| `JWT_SECRET` | Clave para firmar los tokens JWT. Inventa una propia |
| `PORT` | Puerto donde correrá la API (por defecto `3000`) |
| `CACHE_ENABLED` | Opcional. `false` desactiva el caché |
| `CACHE_TTL_SEGUNDOS` | Opcional. TTL único para todas las rutas (si no se define, cada ruta usa el suyo) |
| `ALLOWED_ORIGINS` | Opcional. Orígenes que pueden usar la API desde un navegador, separados por comas (por defecto `http://localhost:3000,http://127.0.0.1:3000`). Ver la sección *CORS* |
| `CORS_EXIGIR_ORIGEN` | Opcional. `true` rechaza también las peticiones sin cabecera `Origin` (Postman, curl, Cypress). Por defecto `false` |

> ⚠️ **Nunca subas tu `.env` a GitHub.** Ya está incluido en `.gitignore`.

## 5. Ejecutar la API

```bash
npm start
```

Deberías ver:

```
Servidor funcionando en http://localhost:3000
```

Para comprobar que funciona, abre en el navegador `http://localhost:3000/`. Debe responder:

```json
{ "mensaje": "API FinanControl funcionando", "baseDatos": "Conectada" }
```

Para detener el servidor, presiona `Ctrl + C`.

Con el servidor encendido, abre `http://localhost:3000/` en el navegador para usar la **aplicación web** y `http://localhost:3000/api-docs` para ver la **documentación Swagger**.

## 6. Ejecutar las pruebas

```bash
npm test
```

Para generar el reporte de cobertura:

```bash
npm run test:coverage
```

El reporte HTML queda en `coverage/lcov-report/index.html` (ábrelo con el navegador). La carpeta `coverage/` no se sube al repositorio, se genera en cada equipo.

> Las pruebas de `server.test.js`, `flujo.test.js` y `contrato.test.js` se conectan a la base de datos real configurada en tu `.env`, así que MySQL debe estar encendido y las tablas creadas antes de correrlas. Crean sus propios usuarios de prueba y los eliminan al terminar.

## 7. Ejecutar Cypress (E2E de la API)

Las pruebas de la API usan `cy.request()` y la prueba de la interfaz abre la aplicación web en el navegador. Primero levanta el servidor y, en **otra terminal**:

```bash
npm run cy:run      # modo headless
npm run cy:open     # modo interactivo
```

Las especificaciones están en `cypress/e2e/` y cubren autenticación y cuenta, CRUD de ingresos y gastos, filtros y resúmenes, caché (MISS, HIT, 304 e invalidación), contrato, CORS con Swagger y la interfaz web.

## Endpoints (27)

Las rutas marcadas con 🔒 requieren el encabezado `Authorization: Bearer <token>`. El token se obtiene al iniciar sesión. Las fechas usan el formato `AAAA-MM-DD`. El detalle completo (parámetros, esquemas y errores) está en [`docs/openapi.json`](docs/openapi.json).

| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| GET | `/` | Estado de la API y de la base de datos | |
| GET | `/api/prueba-seguridad` | Verifica que el token es válido | 🔒 |
| POST | `/api/usuarios/registro` | Registrar usuario (`nombre`, `correo`, `password`) | |
| POST | `/api/usuarios/login` | Iniciar sesión (`correo`, `password`) y recibir token (2 h) | |
| GET | `/api/usuarios/perfil` | Consultar el perfil | 🔒 |
| PUT | `/api/usuarios/perfil` | Editar nombre y/o correo (entrega un token nuevo) | 🔒 |
| PUT | `/api/usuarios/password` | Cambiar la contraseña | 🔒 |
| DELETE | `/api/usuarios/cuenta` | Eliminar la cuenta con todos sus datos (pide la contraseña) | 🔒 |
| POST | `/api/ingresos` | Crear ingreso | 🔒 |
| GET | `/api/ingresos` | Listar ingresos (filtros `desde`, `hasta`, `buscar`, `pagina`, `limite`) | 🔒 |
| GET | `/api/ingresos/:id` | Consultar un ingreso | 🔒 |
| PUT | `/api/ingresos/:id` | Actualizar un ingreso | 🔒 |
| DELETE | `/api/ingresos/:id` | Eliminar un ingreso | 🔒 |
| POST | `/api/gastos` | Crear gasto | 🔒 |
| GET | `/api/gastos` | Listar gastos (filtros `desde`, `hasta`, `buscar`, `categoria`, `pagina`, `limite`) | 🔒 |
| GET | `/api/gastos/categoria/:categoria` | Listar gastos de una categoría | 🔒 |
| GET | `/api/gastos/categorias` | Categorías usadas con cantidad, total y porcentaje | 🔒 |
| GET | `/api/gastos/:id` | Consultar un gasto | 🔒 |
| PUT | `/api/gastos/:id` | Actualizar un gasto | 🔒 |
| DELETE | `/api/gastos/:id` | Eliminar un gasto | 🔒 |
| GET | `/api/movimientos` | Ingresos y gastos juntos (filtros `desde`, `hasta`, `tipo`, `categoria`, `buscar`, paginación) | 🔒 |
| GET | `/api/movimientos/exportar` | Exportar los movimientos a CSV | 🔒 |
| GET | `/api/saldo` | Total de ingresos, total de gastos y saldo | 🔒 |
| GET | `/api/resumen` | Resumen de un periodo con gastos por categoría (`desde`, `hasta`) | 🔒 |
| GET | `/api/resumen/mensual` | Resumen mes a mes de un año (`?anio=2026`) | 🔒 |
| GET | `/api/cache/estadisticas` | Hits, misses y entradas del caché del usuario | 🔒 |
| DELETE | `/api/cache` | Invalidar el caché del usuario | 🔒 |

**Paginación:** si se envía `pagina` o `limite` (máximo 100), el cuerpo sigue siendo una lista y el total llega en la cabecera `X-Total-Count` (también `X-Page` y `X-Limit`). Sin esos parámetros se devuelve todo.

### Ejemplo rápido

```bash
# 1. Registrarse
curl -X POST http://localhost:3000/api/usuarios/registro \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Juan","correo":"juan@gmail.com","password":"123456"}'

# 2. Iniciar sesión (devuelve el token)
curl -X POST http://localhost:3000/api/usuarios/login \
  -H "Content-Type: application/json" \
  -d '{"correo":"juan@gmail.com","password":"123456"}'

# 3. Usar el token
curl http://localhost:3000/api/saldo \
  -H "Authorization: Bearer TU_TOKEN"

# 4. Consultar por fechas y ver el caché (-i muestra las cabeceras: X-Cache: MISS la primera vez, HIT la segunda)
curl -i "http://localhost:3000/api/gastos?desde=2026-01-01&hasta=2026-01-31" \
  -H "Authorization: Bearer TU_TOKEN"
```

## Interfaz web

La carpeta `public/` contiene una aplicación web (HTML, CSS y JavaScript, sin frameworks ni instalación extra) que la misma API sirve en `http://localhost:3000/`:

- **Acceso:** registro e inicio de sesión (el token JWT se guarda en el navegador).
- **Panel:** saldo, ingresos y gastos totales, gráfica del año, gastos por categoría y últimos movimientos.
- **Ingresos y Gastos:** crear, editar y eliminar, con filtros (texto, fechas, categoría) y paginación.
- **Movimientos:** ingresos y gastos juntos, con filtros y exportación a CSV.
- **Resumen:** totales por periodo y mes a mes.
- **Caché:** estadísticas y una prueba en vivo de `MISS` / `HIT`. La barra superior muestra el `X-Cache` de la última consulta.
- **Perfil:** cambiar datos y contraseña, o eliminar la cuenta.

> Un navegador que pide `/` recibe la aplicación; Postman, curl o Cypress (que piden JSON) reciben el estado de la API como antes.

## Documentación Swagger

Abre `http://localhost:3000/api-docs` para explorar y probar los 27 endpoints. Para probar rutas protegidas: haz login en `POST /api/usuarios/login`, copia el `token`, pulsa **Authorize** e ingrésalo. El contrato crudo está en `/api-docs/openapi.json`.

> Swagger UI se carga desde un CDN (jsDelivr), por lo que la página necesita internet. Si no hay conexión, se muestra un aviso con el enlace al contrato.

## CORS

Los navegadores envían la cabecera `Origin` cuando una página de **otro sitio** llama a la API. La API solo acepta los orígenes de `ALLOWED_ORIGINS` (y siempre su propio origen); a cualquier otro le responde `403` y no le entrega cabeceras `Access-Control-*`, así que el navegador bloquea la respuesta. Esto incluye las peticiones *preflight* (`OPTIONS`).

Para demostrarlo con Postman o curl, agrega la cabecera `Origin` a mano:

```bash
# Origen permitido: responde normal y trae Access-Control-Allow-Origin
curl -i -H "Origin: http://localhost:3000" http://localhost:3000/api/saldo

# Origen NO permitido: 403 {"mensaje":"Acceso bloqueado por CORS: el origen no está permitido"}
curl -i -H "Origin: http://sitio-malicioso.com" http://localhost:3000/api/saldo
```

Las peticiones **sin** `Origin` (Postman, curl, Cypress, otro servidor) no pasan por CORS, porque CORS es una protección del navegador; se dejan pasar salvo que pongas `CORS_EXIGIR_ORIGEN=true`. Para autorizar otro frontend, agrégalo a `ALLOWED_ORIGINS` y reinicia el servidor.

## Caché

Las consultas `GET` usan un caché en memoria (estrategia *Cache-Aside*):

- **Por usuario:** la clave incluye el id del usuario y la URL con sus filtros; nadie ve datos ajenos.
- **TTL por ruta** (no existe un TTL universal): `/api/saldo` 30 s, `/api/resumen` 120 s, el resto 60 s. Se puede fijar uno único con `CACHE_TTL_SEGUNDOS`, o desactivar el caché con `CACHE_ENABLED=false`.
- **Invalidación:** cualquier `POST`, `PUT` o `DELETE` exitoso borra el caché del usuario; también se puede hacer a mano con `DELETE /api/cache`.
- **Cabeceras:** `X-Cache: HIT | MISS`, `Cache-Control: private, no-cache` y `ETag`. Si el cliente envía `If-None-Match` con el ETag vigente, la API responde `304 Not Modified` sin cuerpo.
- Los errores (400, 401, 404…) nunca se guardan.

> El caché vive en la memoria del proceso: se pierde al reiniciar y no se comparte entre varias instancias. Para producción con varias instancias se reemplazaría por Redis.

## Contrato de la API

[`docs/openapi.json`](docs/openapi.json) describe los 27 endpoints (OpenAPI 3.1). La prueba `tests/contrato.test.js` falla si agregas una ruta al código sin documentarla, o si una respuesta real no cumple su esquema. Si agregas un endpoint, documéntalo en el contrato.

## Estructura del proyecto

```
financontrol-finanzas/
├── src/
│   ├── config/database.js      # Conexión a MySQL
│   ├── docs/swagger.js         # Documentación Swagger en /api-docs
│   ├── middleware/
│   │   ├── auth.js             # Middleware de verificación JWT
│   │   ├── cache.js            # Caché en memoria por usuario (TTL, ETag, invalidación)
│   │   └── cors.js             # CORS con lista blanca de orígenes
│   ├── routes/                 # perfil, movimientos, resumen, categorías y gestión del caché
│   ├── services/compra.js      # Función calcularTotalCompra
│   ├── utils/filtros.js        # Fechas, paginación y filtros compartidos
│   ├── server.js               # App Express: usuarios, ingresos, gastos y saldo
│   └── index.js                # Arranca el servidor
├── public/                     # Aplicación web (index.html, css/, js/)
├── tests/                      # Jest: unitarias, flujo completo, contrato, CORS y docs
├── cypress/e2e/                # Pruebas E2E de la API con cy.request()
├── docs/
│   ├── openapi.json            # Contrato de la API
│   └── schema.sql              # Esquema de la base de datos
├── cypress.config.js
├── .env.example                # Plantilla de variables de entorno
├── package.json
└── README.md
```

## Problemas comunes

| Error | Causa probable | Solución |
|---|---|---|
| `Cannot find module ...` | No se instalaron las dependencias | Ejecuta `npm install` |
| `ECONNREFUSED` o `Access denied for user` | MySQL apagado o credenciales incorrectas | Enciende MySQL (en WSL: `sudo service mysql start`) y revisa `DB_*` en `.env` |
| `Table '...' doesn't exist` | Faltan las tablas | Ejecuta `docs/schema.sql` (paso 3) |
| `secretOrPrivateKey must have a value` | Falta `JWT_SECRET` en `.env` | Agrégalo y reinicia |
| `EADDRINUSE` | El puerto ya está en uso | Cierra el otro servidor o cambia `PORT` en `.env` |
| `.env` no existe | No se creó desde la plantilla | Repite el paso 4 |
| Cypress no encuentra su programa | Falló la descarga al instalar | Ejecuta `npx cypress install` |
| La página `/api-docs` muestra "No se pudo cargar Swagger UI" | No hay internet (se carga desde un CDN) | Conéctate a internet o lee el contrato en `/api-docs/openapi.json` |
| `403 Acceso bloqueado por CORS` | El origen de la petición no está en `ALLOWED_ORIGINS` | Agrégalo a `ALLOWED_ORIGINS` en `.env` y reinicia |
| Cypress da `ECONNREFUSED` | El servidor no está encendido | Ejecuta `npm start` en otra terminal antes de `npm run cy:run` |

## Tecnologías

Node.js · Express 5 · MySQL (`mysql2`) · JWT (`jsonwebtoken`) · bcryptjs · dotenv · Jest · Supertest · Cypress

## Equipo

Juan David Moreno · Edwin Camilo Pipicano · Cesar Andres Pelaez
