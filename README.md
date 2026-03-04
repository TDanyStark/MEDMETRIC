# MEDMETRIC

Stack inicial con frontend React y backend SlimPHP (plantilla oficial `slim/slim-skeleton`).

## Estructura

```txt
MEDMETRIC/
  frontend/                 # React + Vite
  backend/                  # Slim Skeleton (oficial)
  deploy/hostinger/
    root.htaccess           # SPA fallback de React
    api.htaccess            # Front controller de Slim
```

## Backend (Slim Skeleton)

- Basado en la plantilla oficial: `slim/slim-skeleton`
- Archivo de entrada: `backend/public/index.php`
- Ruta health: `GET /api/health`
- Conexion MySQL por PDO: `backend/src/Infrastructure/Database/Connection.php`
- Variables de entorno: `backend/.env`

### Variables `.env`

```env
APP_NAME=MEDMETRIC
APP_ENV=development
APP_DEBUG=true
API_PREFIX=/api

DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=medmetric
DB_USER=root
DB_PASS=
DB_CHARSET=utf8mb4
```

## Desarrollo local

1. Backend:

```bash
cd backend
composer install
composer start
```

2. Frontend:

```bash
cd frontend
npm install
npm run dev
```

3. Abrir:

- `http://localhost:5173`
- `http://localhost:8081/api/health`

## Despliegue en Hostinger (subdominio)

Objetivo:

- `https://medmetric.market-support.com/` -> React
- `https://medmetric.market-support.com/api/*` -> Slim

Pasos:

1. Build frontend:

```bash
cd frontend
npm run build
```

2. Backend produccion:

```bash
cd backend
composer install --no-dev --optimize-autoloader
```

3. Subir al docroot del subdominio:

- `frontend/dist/*` -> `public_html/`
- `deploy/hostinger/root.htaccess` -> `public_html/.htaccess`
- Crear `public_html/api/`
- Copiar `backend/public/index.php` -> `public_html/api/index.php`
- Copiar `deploy/hostinger/api.htaccess` -> `public_html/api/.htaccess`

4. Codigo privado recomendado (si Hostinger lo permite):

- Guardar `backend/src`, `backend/app`, `backend/vendor`, `backend/.env` fuera de `public_html`
- Dejar solo `index.php` publico en `public_html/api/`

5. Verificar:

- `https://medmetric.market-support.com/`
- `https://medmetric.market-support.com/api/health`
