# AGENTS

## Proyecto

Sistema web para gestion y distribucion de materiales medicos con medicion de metricas de consumo.

- Backend: SlimPHP (API REST)
- Frontend: React (SPA)
- Base de datos: MySQL
- Deploy: Hostinger (subdominio)
- Dominio objetivo: `medmetric.market-support.com`

## Arquitectura Base

- Frontend sirve en `/`
- Backend Slim se expone bajo `/api`
- Toda llamada del frontend al backend debe usar rutas relativas `/api/...`
- Produccion en Hostinger:
  - `public_html/` -> build de React
  - `public_html/api/` -> front controller de Slim
  - `.htaccess` para SPA fallback y routing de API

## Objetivo del Negocio

Permitir cargar y mostrar materiales promocionales/cientificos en visitas medicas, con trazabilidad de consumo por visitante y por contexto comercial.

Tipos de materiales iniciales:

- PDF
- Video
- Enlace externo (apps/plataformas)

La plataforma debe registrar metricas de visualizacion e interaccion de cada visita.

## Modelo Organizacional

El sistema es multi-organizacion (tenant-like por cliente).

Ejemplos:

- Cliente/organizacion: Abbott
  - 10 gerentes
  - cada gerente con 10 visitadores medicos
- Cliente/organizacion: Addion
  - 5 gerentes
  - cada gerente con 3 visitadores medicos

El administrador debe poder crear y gestionar estas estructuras.

## Roles y Permisos

### 1) Administrador

- Acceso total a la plataforma
- Crea organizaciones/clientes
- Gestiona usuarios (gerentes y visitadores)
- Supervisa y audita metricas globales
- Configura reglas y catalogos maestros

### 2) Gerente

- Pertenece a una organizacion
- Crea y gestiona marcas
- Crea y gestiona materiales (PDF, video, link externo)
- Crea y gestiona visitadores medicos de su alcance
- Publica o solicita aprobacion de contenido segun flujo definido

### 3) Visitador Medico

- Pertenece a una organizacion y responde a un gerente
- Accede a materiales aprobados/publicados
- Usa el contenido durante la visita medica
- Genera sesiones/links para que el medico vea el contenido

### 4) Medico (sin login)

- No se autentica
- Accede al contenido por URL firmada/tokenizada
- Debe poder consumir material sin pasos extra
- Su navegacion y consumo generan metricas asociadas al contexto de visita

## Requisitos Funcionales Iniciales

1. Gestion de organizaciones (clientes)
2. Gestion de usuarios por rol
3. Gestion de marcas por organizacion
4. Carga y gestion de materiales por tipo (PDF/video/enlace)
5. Flujo de aprobacion/publicacion de contenido
6. Biblioteca de contenido aprobado para visitadores
7. Acceso publico controlado para medicos mediante URL con token
8. Captura de metricas de consumo y navegacion

## Metricas Minimas a Registrar

- Identificador de sesion de visita
- Organizacion, gerente, visitador, marca y material
- Tipo de material (pdf/video/link)
- Timestamp de inicio y fin
- Duracion total de visualizacion
- Eventos:
  - apertura de material
  - cierre
  - porcentaje visto (video/pdf)
  - clics salientes (enlaces externos)
- Datos tecnicos basicos:
  - user-agent
  - ip (si politica lo permite)
  - dispositivo aproximado

## Lineamientos Tecnicos

### Backend (SlimPHP)

- API REST versionable (`/api/v1` sugerido en siguiente etapa)
- Autenticacion para usuarios internos (admin/gerente/visitador)
- Tokens de acceso publico para medico con expiracion y firma
- Validacion robusta de input
- Logging estructurado y manejo de errores consistente
- Capas sugeridas: rutas, servicios, repositorios, dominio

### Frontend (React)

- SPA con rutas protegidas por rol
- Modulo de administracion (organizaciones y usuarios)
- Modulo de contenido (carga, aprobacion, biblioteca)
- Vista de reproduccion/lectura para visita medica
- Vista publica de medico optimizada para acceso inmediato

### Base de Datos (MySQL)

Entidades sugeridas para el arranque:

- organizations
- brands
- users
- roles
- user_organization_rel
- materials
- material_approvals
- visit_sessions
- material_events
- external_link_events

## Seguridad y Cumplimiento

- Principio de minimo privilegio por rol
- URLs publicas firmadas, expiran y son revocables
- Sanitizacion de archivos y validacion de tipo MIME
- Limites de tamano de upload
- Politica de retencion de metricas
- Considerar anonimizar datos sensibles del medico cuando aplique

## Convenciones de Desarrollo

- Mantener separacion clara frontend/backend
- No acoplar React a detalles internos de Slim
- Definir contratos de API (request/response) antes de UI final
- Agregar migraciones SQL versionadas
- Escribir seeds para datos demo de organizaciones/roles

## Deploy en Hostinger

- Build frontend: `npm run build`
- Backend produccion: `composer install --no-dev --optimize-autoloader`
- Copiar dist a `public_html/`
- Montar Slim en `public_html/api/`
- Configurar `.env` de produccion (DB, app env, secretos)
- Verificar rutas:
  - `/` SPA
  - `/api/health` API

## Roadmap Sugerido (MVP)

1. Auth + RBAC (admin/gerente/visitador)
2. Organizaciones y jerarquia de usuarios
3. Marcas y carga de materiales
4. Flujo de aprobacion/publicacion
5. Sesion de visita + URL publica para medico
6. Recoleccion y dashboard inicial de metricas

## Buenas practicas

1. No repitas codigo, si ves que algo se puede repetir crea los metodos o funciones o componentes en un lugar
2. Siempre ten en cuenta esos lugares de funciones, metodos y componentes, para que busques si ya existe algo que te pueda servir y no repetir codigo