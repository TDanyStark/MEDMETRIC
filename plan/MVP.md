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
4. `brands` (catalogo maestro, unico por organizacion, sin manager_id)
5. `manager_brands` (asignacion marca -> gerente, una marca puede tener muchos gerentes)
6. `materials`
7. `rep_manager_access` (suscripcion rep -> gerente)
8. `visit_sessions`
9. `visit_session_materials` (materiales elegidos para la sesion)
10. `material_views`

### Campos clave

- `users.last_login_at` para saber ultima vez que se logueo el visitador
- `materials.type` = `pdf|video|link`
- `materials.storage_driver` = `local|s3` (inicia en `local`)
- `materials.status` = `draft|approved|archived`
- `visit_sessions.doctor_token` (sin expiracion en MVP)
- `material_views.viewer_type` = `rep|doctor`
- `material_views.opened_at`

### Seeds iniciales

- Roles: `superadmin`, `org_admin`, `manager`, `rep`
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
5. Middleware de roles (superadmin/org_admin/manager/rep)
6. Registrar `last_login_at` en login exitoso

### Reglas

- Token expira cada 1 dia
- Debe requerir nuevo login diario
- Hash de password con `password_hash`/`password_verify`

### Resultado esperado

- Seguridad base lista y reusable en todos los modulos.

---

## [x] Fase 3 - Modulo Super Admin (organizaciones y administradores de organización)

### Objetivo

Permitir al Super Admin crear y gestionar organizaciones y asignar administradores de organización.

### Reglas de marcas

- Las marcas son unicas por organizacion (no puede haber 2 "Bellaface" en Abbott)
- Una marca puede ser asignada a multiples gerentes
- Un gerente puede tener muchas marcas asignadas
- El admin crea las marcas y luego las asigna a los gerentes

### Endpoints MVP

- `GET /api/v1/superadmin/organizations`
- `POST /api/v1/superadmin/organizations`
- `PUT /api/v1/superadmin/organizations/{id}`
- `GET /api/v1/superadmin/org-admins`
- `POST /api/v1/superadmin/org-admins` (crear y asignar a organización)
- `PUT /api/v1/superadmin/org-admins/{id}`
- `DELETE /api/v1/superadmin/org-admins/{id}` (quitar de organización)

### Reglas

- Super Admin crea organizaciones
- Super Admin crea administradores de organización y los asigna a una organización específica
- Un administrador de organización solo puede estar asignado a una organización
- Super Admin puede ver métricas globales de todas las organizaciones

### Resultado esperado

- Jerarquía de Super Admin -> Org Admin -> Organización operativa.

---

## [x] Fase 4 - Modulo Admin de Organización (usuarios y marcas)

### Objetivo

Permitir al administrador de organización gestionar todo lo relacionado a su organización: usuarios, marcas y asignaciones.

### Reglas de marcas

- Las marcas son únicas por organización (no puede haber 2 "Bellaface" en Abbott)
- Una marca puede ser asignada a múltiples gerentes
- Un gerente puede tener muchas marcas asignadas
- El admin de organización crea las marcas y luego las asigna a los gerentes
- El admin de organización solo ve y gestiona usuarios de su propia organización

### Endpoints MVP

- `GET /api/v1/org-admin/users`
- `POST /api/v1/org-admin/users` (crear gerentes y visitadores)
- `PUT /api/v1/org-admin/users/{id}`
- `GET /api/v1/org-admin/brands`
- `POST /api/v1/org-admin/brands`
- `PUT /api/v1/org-admin/brands/{id}`
- `GET /api/v1/org-admin/managers/{id}/brands`
- `PUT /api/v1/org-admin/managers/{id}/brands`

### Reglas

- Org Admin solo puede crear usuarios dentro de su propia organización
- Org Admin asigna marcas a gerentes de su organización
- Un visitador puede estar suscrito a múltiples gerentes
- Todos los endpoints filtran automáticamente por la organización del admin

### Resultado esperado

- Administración completa de organización por su admin asignado.

---

## [x] Fase 5 - Modulo Gerente (materiales y visitadores)

### Objetivo

Permitir al gerente crear contenido y gestionar visitadores.

### Reglas

- El gerente NO crea marcas, las usa de las que le fueron asignadas por el admin de organización
- El gerente ve solo las marcas que tiene asignadas
- Crea materiales asociados a sus marcas

### Endpoints MVP

- `GET /api/v1/manager/brands` (marcas asignadas al gerente)
- `GET /api/v1/manager/materials`
- `POST /api/v1/manager/materials`
- `PUT /api/v1/manager/materials/{id}`
- `POST /api/v1/manager/materials/{id}/approve`
- `GET /api/v1/manager/reps` (visitadores asignados)
- `GET /api/v1/manager/reps/available`
- `POST /api/v1/manager/reps` (asignar visitadores)
- `DELETE /api/v1/manager/reps` (quitar visitadores)

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

## [x] Fase 6 - Modulo Visitador (biblioteca y sesion)

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

## [x] Fase 7 - Acceso publico medico + metrica base

### Objetivo

Permitir al medico ver contenido sin login y registrar interacciones clave.

### Endpoints MVP

- `GET /api/v1/public/session/{token}`
- `POST /api/v1/public/material/{id}/open`
- `GET /api/v1/public/material/{id}/resource`

### Comportamiento

- PDF: servir archivo local via plataforma
- Video: devolver URL de YouTube (embebido o apertura controlada)
- Link externo: registrar evento y redirigir

### Metricas minimas obligatorias

- Quién vio material: `rep` o `doctor`
- Material visto
- Fecha/hora de apertura
- (Opcional recomendado) user-agent e IP

### Resultado esperado

- Trazabilidad minima lista para analisis de uso.

---

## Fase 8 - Frontend base (React + TS + Tailwind + shadcn/ui )

### Objetivo

Definir base visual y tecnica del frontend con rutas por rol.

### Tareas

1. Instalar Tailwind
2. Configurar shadcn/ui
3. Crear layout base y sistema de navegacion por rol
4. Implementar rutas protegidas:
   - `/login`
   - `/superadmin/*`
   - `/org-admin/*`
   - `/manager/*`
   - `/rep/*`
   - `/public/visit/:token`

### Resultado esperado

- Frontend escalable, limpio y consistente.

---

## Fase 9 - Frontend Super Admin + Org Admin + Manager

### Objetivo

Completar operacion interna principal.

### Pantallas

- Super Admin:
  - Organizaciones (listar/crear/editar)
  - Administradores de organización (listar/crear/editar/asignar)
  - Métricas globales (vista de todas las organizaciones)
- Org Admin:
  - Usuarios (listar/crear/editar - gerentes y visitadores)
  - Marcas (crear y asignar a gerentes)
  - Métricas de su organización
- Manager:
  - Marcas asignadas
  - Materiales (crear PDF/video/link, aprobar)

### Resultado esperado

- Backoffice principal en operacion.

---

## Fase 10 - Frontend Visitador + vista medico

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

## Fase 11 - Insights MVP

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

- Org Admin y gerente pueden medir uso real del contenido.

---

## Lineamientos de Frontend

- Usar TypeScript en todo el frontend (.tsx / .ts), sin archivos .js ni .jsx
- Todos los filtros y parametros de busqueda deben persistirse en la URL como query params, para que el estado sea navegable, compartible y sobreviva a recargas de pagina.
- Ejemplo: `/admin/users?role=manager&organization_id=2&q=garcia&page=2`

## Lineamientos de Backend

- Todos los endpoints de listado deben aceptar los mismos filtros que se exponen en el frontend como query params (ej. `role`, `organization_id`, `q`).
- Todos los listados deben estar paginados: maximo de items por pagina definido en una sola constante global (`PaginationConfig::PAGE_SIZE`), inicialmente en 20; ese numero debe poder cambiarse desde un unico lugar sin tocar los repositorios ni las acciones.
- La respuesta paginada debe incluir siempre metadatos: `total`, `page`, `per_page`, `last_page`.

---

## Checklist de definicion por fase

Para avanzar entre fases, validar siempre:

1. Migraciones aplicadas y reversibles
2. Endpoints documentados (request/response)
3. Casos de error controlados
4. Seguridad minima (auth/rol/input)
5. Pruebas de smoke (`/api/v1/health` + endpoints nuevos)
6. UI conectada a API real
7. Filtros de listados persistidos en URL (query params)

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

- Super Admin crea organizaciones y asigna administradores de organización
- Org Admin crea gerentes, visitadores y marcas dentro de su organización
- Org Admin asigna marcas a gerentes
- Gerente crea materiales en sus marcas asignadas y los aprueba
- Visitador inicia sesion diaria (JWT 24h), accede biblioteca y comparte link
- Medico accede sin login mediante token y consume contenido
- Sistema registra quién vio el material y a que hora
- Sistema registra ultimo login del visitador
