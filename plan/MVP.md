# Plan MVP MEDMETRIC

## Objetivo

Construir un MVP funcional por fases para gestionar materiales medicos (PDF, video de YouTube y enlaces externos), distribuirlos en visitas medicas y registrar metricas de uso por rol.

Stack confirmado:

- Backend: SlimPHP (arquitectura limpia)
- Frontend: React
- DB: MySQL
- Deploy: Hostinger (`/` frontend, `/api` backend)

Decisiones cerradas para MVP:

- El gerente aprueba contenido directamente (luego se agrega rol aprobador)
- JWT interno dura 1 dia (login diario)
- Link/token para medico no expira en MVP
- PDFs se guardan localmente, pero con abstraccion para migrar a S3 luego

---

## [x] Fase 0 - Preparacion y estructura base

### Objetivo

Dejar una base estable para implementar por modulos sin deuda estructural.

### Tareas

1. Confirmar estructura limpia en backend:
   - `src/Domain`
   - `src/Application`
   - `src/Infrastructure`
2. Agregar carpetas de proyecto:
   - `backend/database/migrations`
   - `backend/database/seeds`
   - `backend/storage/materials`
3. Definir convencion API versionada:
   - MVP en `/api/v1`
4. Definir contrato estandar de respuesta/error JSON.

### Resultado esperado

- Proyecto listo para crecer por capas y por fases.

---

## [x] Fase 1 - Modelo de datos (MySQL)

### Objetivo

Crear el esquema minimo para multi-organizacion, materiales, sesiones y metricas.

### Tablas MVP

1. `organizations`
2. `roles`
3. `users`
4. `brands`
5. `materials`
6. `rep_manager_access` (suscripcion rep -> gerente)
7. `visit_sessions`
8. `visit_session_materials` (materiales elegidos para la sesion)
9. `material_views`
10. `material_events` (opcional MVP temprano, recomendado)

### Campos clave

- `users.last_login_at` para saber ultima vez que se logueo el visitador
- `materials.type` = `pdf|video|link`
- `materials.storage_driver` = `local|s3` (inicia en `local`)
- `materials.status` = `draft|approved|archived`
- `visit_sessions.doctor_token` (sin expiracion en MVP)
- `material_views.viewer_type` = `rep|doctor`
- `material_views.opened_at`, `material_views.closed_at`

### Seeds iniciales

- Roles: `admin`, `manager`, `rep`
- Organizaciones demo: `Abbott`, `Addion`
- Usuarios demo por rol

### Resultado esperado

- Esquema SQL versionado y datos semilla listos.

---

## [x] Fase 2 - Autenticacion y RBAC (Backend)

### Objetivo

Autenticar usuarios internos y proteger endpoints por rol.

### Tareas

1. Implementar `POST /api/v1/auth/login`
2. Implementar `GET /api/v1/auth/me`
3. Generar JWT con expiracion de 24h
4. Middleware JWT (`Authorization: Bearer`)
5. Middleware de roles (admin/manager/rep)
6. Registrar `last_login_at` en login exitoso

### Reglas

- Token expira cada 1 dia
- Debe requerir nuevo login diario
- Hash de password con `password_hash`/`password_verify`

### Resultado esperado

- Seguridad base lista y reusable en todos los modulos.

---

## Fase 3 - Modulo Admin (organizaciones y usuarios)

### Objetivo

Permitir al administrador crear y gestionar estructura organizacional.

### Endpoints MVP

- `GET /api/v1/admin/organizations`
- `POST /api/v1/admin/organizations`
- `PUT /api/v1/admin/organizations/{id}`
- `GET /api/v1/admin/users`
- `POST /api/v1/admin/users`
- `PUT /api/v1/admin/users/{id}`

### Reglas

- Admin puede crear gerentes y visitadores
- Usuario siempre pertenece a una organizacion
- Un visitador puede estar suscrito a multiples gerentes

### Resultado esperado

- Jerarquia organizacional operativa.

---

## Fase 4 - Modulo Gerente (marcas y materiales)

### Objetivo

Permitir al gerente crear marcas y contenido.

### Endpoints MVP

- `GET/POST/PUT /api/v1/manager/brands`
- `GET /api/v1/manager/materials`
- `POST /api/v1/manager/materials`
- `PUT /api/v1/manager/materials/{id}`
- `POST /api/v1/manager/materials/{id}/approve`

### Manejo por tipo de material

1. PDF:
   - Upload a servidor local (`storage/materials/...`)
   - Guardar `storage_driver=local`, `storage_path`
2. Video:
   - Guardar URL de YouTube en `external_url`
3. Link externo:
   - Guardar URL en `external_url`

### Preparacion para S3

- Definir interfaz `StorageServiceInterface`
- Implementar `LocalStorageService`
- Dejar `S3StorageService` como siguiente implementacion plug-and-play

### Resultado esperado

- Contenido creado y aprobado por gerente, listo para consumo.

---

## Fase 5 - Modulo Visitador (biblioteca y sesion)

### Objetivo

Permitir al visitador usar material aprobado y generar acceso para medico.

### Endpoints MVP

- `GET /api/v1/rep/materials`
- `POST /api/v1/rep/visit-sessions`
- `GET /api/v1/rep/visit-sessions`

### Reglas

- Visitador solo ve materiales aprobados de sus gerentes suscritos
- Al crear sesion, se seleccionan materiales especificos y se genera `doctor_token`
- Token medico no expira en MVP

### Resultado esperado

- Flujo real de visita medico-representante funcionando.

---

## Fase 6 - Acceso publico medico + metrica base

### Objetivo

Permitir al medico ver contenido sin login y registrar interacciones clave.

### Endpoints MVP

- `GET /api/v1/public/session/{token}`
- `POST /api/v1/public/material/{id}/open`
- `POST /api/v1/public/material/{id}/close`
- `GET /api/v1/public/material/{id}/resource`

### Comportamiento

- PDF: servir archivo local via plataforma
- Video: devolver URL de YouTube (embebido o apertura controlada)
- Link externo: registrar evento y redirigir

### Metricas minimas obligatorias

- Quién vio material: `rep` o `doctor`
- Material visto
- Fecha/hora de apertura y cierre
- (Opcional recomendado) user-agent e IP

### Resultado esperado

- Trazabilidad minima lista para analisis de uso.

---

## Fase 7 - Frontend base (React + Tailwind + shadcn/ui)

### Objetivo

Definir base visual y tecnica del frontend con rutas por rol.

### Tareas

1. Instalar Tailwind
2. Configurar shadcn/ui
3. Crear layout base y sistema de navegacion por rol
4. Implementar rutas protegidas:
   - `/login`
   - `/admin/*`
   - `/manager/*`
   - `/rep/*`
   - `/public/visit/:token`

### Resultado esperado

- Frontend escalable, limpio y consistente.

---

## Fase 8 - Frontend Admin + Manager

### Objetivo

Completar operacion interna principal.

### Pantallas

- Admin:
  - Organizaciones (listar/crear/editar)
  - Usuarios (listar/crear/editar)
- Manager:
  - Marcas
  - Materiales (crear PDF/video/link, aprobar)

### Resultado esperado

- Backoffice principal en operacion.

---

## Fase 9 - Frontend Visitador + vista medico

### Objetivo

Completar flujo de campo y experiencia publica.

### Pantallas

- Visitador:
  - Biblioteca aprobada
  - Crear sesion y compartir link
  - Historial de sesiones
- Medico (publico):
  - Lista de materiales
  - Vista PDF
  - Vista YouTube
  - Boton/link a app externa

### Resultado esperado

- Flujo end-to-end completo entre roles.

---

## Fase 10 - Insights MVP

### Objetivo

Mostrar indicadores simples para validar adopcion del contenido.

### Endpoints dashboard (MVP)

- `GET /api/v1/metrics/material-views`
- `GET /api/v1/metrics/rep-last-login`
- `GET /api/v1/metrics/top-materials`

### Indicadores minimos

- Vistas por material (rep vs doctor)
- Ultimo login por visitador
- Ultimas visualizaciones con timestamp

### Resultado esperado

- Admin y gerente pueden medir uso real del contenido.

---

## Checklist de definicion por fase

Para avanzar entre fases, validar siempre:

1. Migraciones aplicadas y reversibles
2. Endpoints documentados (request/response)
3. Casos de error controlados
4. Seguridad minima (auth/rol/input)
5. Pruebas de smoke (`/api/v1/health` + endpoints nuevos)
6. UI conectada a API real

---

## Riesgos y mitigacion

1. **Subida de PDFs en hosting compartido**
   - Mitigar: limites de tamano, validacion MIME, guardado fuera de `public` si es posible.
2. **Migracion futura a S3**
   - Mitigar: usar `storage_driver` + interfaz de storage desde inicio.
3. **Token medico sin expiracion**
   - Mitigar: permitir revocacion manual por sesion en fase siguiente.
4. **Escalabilidad de metricas**
   - Mitigar: indice por `material_id`, `viewer_type`, `opened_at`.

---

## Criterio de MVP completado

El MVP se considera completo cuando:

- Admin crea organizaciones y usuarios
- Gerente crea marca y materiales, y los aprueba
- Visitador inicia sesion diaria (JWT 24h), accede biblioteca y comparte link
- Medico accede sin login mediante token y consume contenido
- Sistema registra quién vio el material y a que hora
- Sistema registra ultimo login del visitador
