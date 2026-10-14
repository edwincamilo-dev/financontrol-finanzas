# FinanControl API – Pruebas unitarias

API REST en **Node.js + Express** para gestionar ingresos y gastos personales, con autenticación **JWT** y base de datos **MySQL**. Incluye pruebas unitarias y de integración con **Jest** y **Supertest**, y reporte de cobertura.

## Requisitos previos

| Herramienta | Versión recomendada | Verificar con |
|---|---|---|
| [Node.js](https://nodejs.org/) | 18 o superior | `node -v` |
| npm | viene con Node.js | `npm -v` |
| [Git](https://git-scm.com/) | cualquiera reciente | `git --version` |
| [MySQL](https://dev.mysql.com/downloads/) | 8.x | `mysql --version` |

## 1. Descargar el proyecto

```bash
git clone https://github.com/edwincamilo-dev/pruebas-unitarias.git
cd pruebas-unitarias
```

> Si no tienes Git, en la página del repositorio pulsa **Code → Download ZIP**, descomprime y abre la terminal dentro de la carpeta.

## 2. Instalar dependencias

```bash
npm install
```

Esto crea la carpeta `node_modules/` (no se sube al repositorio, cada persona la genera).

## 3. Configurar la base de datos

Crea una base de datos en MySQL y las tablas que usa la API. Este es un esquema de referencia (ajusta nombres de base de datos, tipos y tamaños si tu equipo usa otros):

```sql
CREATE DATABASE financontrol;
USE financontrol;

CREATE TABLE usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  correo VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL
);

CREATE TABLE ingresos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  descripcion VARCHAR(255) NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  fecha DATE NOT NULL,
  usuario_id INT NOT NULL,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE TABLE gastos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  descripcion VARCHAR(255) NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  categoria VARCHAR(100) NOT NULL,
  fecha DATE NOT NULL,
  usuario_id INT NOT NULL,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);
```

## 4. Configurar las variables de entorno

El archivo `.env` **no está en el repositorio** porque contiene datos privados. Crea el tuyo a partir de la plantilla:

**Windows (cmd):**
```cmd
copy .env.example .env
```

**Mac / Linux / Git Bash:**
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

> ⚠️ **Nunca subas tu `.env` a GitHub.** Ya está incluido en `.gitignore`.

## 5. Ejecutar la API

```bash
node index.js
```

Deberías ver:

```
Servidor funcionando en http://localhost:3000
```

Para comprobar que funciona, abre en el navegador `http://localhost:3000/`. Debe responder:

```json
{ "mensaje": "API FinanControl funcionando", "baseDatos": "Conectada" }
```

## 6. Ejecutar las pruebas

```bash
npm test
```

Para generar el reporte de cobertura:

```bash
npx jest --coverage
```

El reporte HTML queda en `coverage/lcov-report/index.html` (ábrelo con el navegador). La carpeta `coverage/` no se sube al repositorio, se genera en cada equipo.

> Las pruebas de `server.test.js` se conectan a la base de datos real configurada en tu `.env`, así que MySQL debe estar encendido y las tablas creadas antes de correrlas.

## Endpoints

Las rutas marcadas con 🔒 requieren el encabezado `Authorization: Bearer <token>`. El token se obtiene al iniciar sesión.

| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| GET | `/` | Estado de la API y de la base de datos | |
| POST | `/api/usuarios/registro` | Registrar usuario (`nombre`, `correo`, `password`) | |
| POST | `/api/usuarios/login` | Iniciar sesión (`correo`, `password`) y recibir token | |
| GET | `/api/prueba-seguridad` | Verifica que el token es válido | 🔒 |
| POST | `/api/ingresos` | Crear ingreso | 🔒 |
| GET | `/api/ingresos` | Listar ingresos del usuario | 🔒 |
| GET | `/api/ingresos/:id` | Consultar un ingreso | 🔒 |
| PUT | `/api/ingresos/:id` | Actualizar un ingreso | 🔒 |
| DELETE | `/api/ingresos/:id` | Eliminar un ingreso | 🔒 |
| POST | `/api/gastos` | Crear gasto | 🔒 |
| GET | `/api/gastos` | Listar gastos del usuario | 🔒 |
| GET | `/api/gastos/categoria/:categoria` | Listar gastos por categoría | 🔒 |
| GET | `/api/gastos/:id` | Consultar un gasto | 🔒 |
| PUT | `/api/gastos/:id` | Actualizar un gasto | 🔒 |
| DELETE | `/api/gastos/:id` | Eliminar un gasto | 🔒 |
| GET | `/api/saldo` | Saldo del usuario (ingresos − gastos) | 🔒 |

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
```

## Estructura del proyecto

```
pruebas-unitarias/
├── index.js            # Arranca el servidor
├── server.js           # Rutas y lógica de la API
├── auth.js             # Middleware de verificación JWT
├── database.js         # Conexión a MySQL
├── compra.js           # Función calcularTotalCompra
├── compra.test.js      # Pruebas unitarias de compra.js
├── server.test.js      # Pruebas de la API (Supertest)
├── .env.example        # Plantilla de variables de entorno
├── package.json
└── README.md
```

## Problemas comunes

| Error | Causa probable | Solución |
|---|---|---|
| `Cannot find module ...` | No se instalaron las dependencias | Ejecuta `npm install` |
| `ECONNREFUSED` o `Access denied for user` | MySQL apagado o credenciales incorrectas | Enciende MySQL y revisa `DB_*` en `.env` |
| `Table '...' doesn't exist` | Faltan las tablas | Ejecuta el SQL del paso 3 |
| `secretOrPrivateKey must have a value` | Falta `JWT_SECRET` en `.env` | Agrégalo y reinicia |
| `EADDRINUSE` | El puerto ya está en uso | Cambia `PORT` en `.env` |
| `.env` no existe | No se creó desde la plantilla | Repite el paso 4 |

## Tecnologías

Node.js · Express 5 · MySQL (`mysql2`) · JWT (`jsonwebtoken`) · bcryptjs · dotenv · Jest · Supertest
