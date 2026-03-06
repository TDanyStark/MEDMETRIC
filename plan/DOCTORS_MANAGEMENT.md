# Plan de Implementación: Sistema de Gestión de Médicos

Este plan detalla la creación de una entidad separada para "Médicos" (Doctors) para evitar duplicados y mejorar la gestión de datos en MEDMETRIC.

## 1. Base de Datos

### Nueva Tabla: `doctors`
- **Archivo**: `backend/database/migrations/013_create_doctors_table.sql`
- **Columnas**:
  - `id`: INT UNSIGNED AUTO_INCREMENT PRIMARY KEY
  - `organization_id`: INT UNSIGNED (FK a `organizations`)
  - `created_by_id`: INT UNSIGNED (FK a `users`, representante que lo creó)
  - `first_name`: VARCHAR(100)
  - `last_name`: VARCHAR(100)
  - `sex`: ENUM('M', 'F', 'O', 'N') (Hombre, Mujer, Otro, Prefiero no decirlo)
  - `email`: VARCHAR(255)
  - `phone`: VARCHAR(50)
  - `address`: TEXT
  - `department`: VARCHAR(100)
  - `city`: VARCHAR(100)
  - `country`: VARCHAR(100)
  - `created_at`, `updated_at`

### Modificación: `visit_sessions`
- **Acción**: Agregar columna `doctor_id` (FK a `doctors.id`).
- **Notas**: Se mantendrá `doctor_name` como respaldo o se migrará a la nueva estructura.

## 2. Backend (Slim Framework)

### Dominios y Repositorios
- **Modelo**: `App\Domain\Doctor\Doctor`
- **Repositorio**: `App\Infrastructure\Persistence\Doctor\DbDoctorRepository`
  - Métodos: `create`, `search` (por nombre/apellido), `findById`, `findAllByOrg`.

### Acciones (Endpoints)
- `POST /api/v1/rep/doctors`: Crear un nuevo médico.
- `GET /api/v1/rep/doctors/search?q=...`: Buscar médicos (debe retornar nombre, ciudad y dirección para el `react-select`).
- `GET /api/v1/org-admin/doctors`: Listado completo para el administrador de la organización, incluyendo quién lo creó.

## 3. Frontend (React + Vite)

### Dependencias
- Instalar `react-select`.

### Componentes Nuevo: `CreateDoctorDialog.tsx`
- Formulario emergente (Popup).
- **Campos**: Nombre, Apellido, Sexo, Email, Celular, Dirección, Departamento, Ciudad, País.
- **Integraciones**:
  - `https://ipapi.co/`: Detectar país por IP al abrir el formulario.
  - `https://countriesnow.space/api/v0.1/countries`: Cargar departamentos/estados y ciudades dinámicamente según el país seleccionado.

### Modificación en `RepPages.tsx` (Creación de Sesión)
- Reemplazar el `Input` de nombre de médico por un `AsyncSelect` de `react-select`.
- El buscador mostrará: "Nombre Apellido - Ciudad (Dirección)".
- Si el médico no existe, permitir abrir el `CreateDoctorDialog`.
- Al crear el médico, cerrar el popup y seleccionar automáticamente al médico recién creado en el select.

### Nueva Página: `OrgAdminDoctorsPage.tsx`
- Tabla con la lista de médicos de la organización.
- Columna adicional: "Creado por" (Nombre del representante).

## 4. Mejoras Propuestas (Ideas)
- **Validación de Duplicados**: Antes de crear, verificar si ya existe un médico con el mismo email o teléfono en la misma organización.
- **Tratamiento**: Usar el campo `sex` para anteponer "Dr." o "Dra." en la vista pública de la sesión.
- **Geolocalización**: Guardar coordenadas opcionales si la dirección se selecciona mediante un buscador de mapas (futuro).
