# Dashboard App

## Requisitos

- **PHP 8.0+** con la extensión `pdo_sqlite` habilitada
- **Node.js 18+** (solo si necesitas importar datos desde Excel)

## Instalación en Windows

### 1. Instalar PHP

1. Descarga PHP desde [https://windows.php.net/download](https://windows.php.net/download) (elige la versión **VS16 x64 Thread Safe**, archivo ZIP).
2. Extrae el ZIP en `C:\php`.
3. Agrega `C:\php` a la variable de entorno `PATH`:
   - Busca "Variables de entorno" en el menú de inicio.
   - En **Variables del sistema**, edita `Path` y agrega `C:\php`.
4. Copia `php.ini-development` como `php.ini` dentro de `C:\php`.
5. Abre `php.ini` y descomenta (quita el `;`) estas líneas:
   ```
   extension=pdo_sqlite
   extension=sqlite3
   ```
6. Verifica en una terminal:
   ```
   php -v
   ```

### 2. Instalar Node.js (opcional, solo para importar datos)

1. Descarga e instala desde [https://nodejs.org](https://nodejs.org).
2. Verifica en una terminal:
   ```
   node -v
   ```

### 3. Clonar el repositorio

```bash
git clone https://github.com/Manuel-Suarez-Abascal/dashboard-app.git
cd dashboard-app
```

### 4. Instalar dependencias de Node.js (opcional)

Solo necesario si vas a importar datos desde un archivo Excel:

```bash
npm install
```

### 5. Importar datos desde Excel (opcional)

Si tienes un archivo `.xlsx` para importar:

1. Coloca el archivo Excel en la carpeta del proyecto.
2. Ejecuta:
   ```bash
   node import.js
   ```
   Esto crea la base de datos en `db/dashboard.db` y exporta los datos a `data/transactions.json`.

### 6. Iniciar el servidor

Desde la carpeta del proyecto, ejecuta:

```bash
php -S localhost:8000
```

Luego abre tu navegador en [http://localhost:8000](http://localhost:8000).

## Estructura del proyecto

```
index.php              → Página principal (frontend)
api.php                → API backend (PHP + SQLite)
js/dashboard.js        → Lógica del dashboard
css/style.css          → Estilos
db/dashboard.db        → Base de datos SQLite (se crea automáticamente)
data/transactions.json → Datos exportados en JSON
import.js              → Script para importar datos desde Excel
```
