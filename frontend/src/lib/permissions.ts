import type { Role } from '@/types'

/**
 * Frontend-only permission helpers. These MUST NOT be treated as the real
 * authorization layer — the backend (`RoleMiddleware` + the `*AccessConfig`
 * classes under `backend/src/Infrastructure/Config/`) is the only source of
 * truth for what a role can actually do. This file exists so the UI never
 * OFFERS an action a role can't execute, even though the backend would
 * reject it anyway (see `sdd/route-role-prefix-removal/spec`, requirement
 * "Contenido scopeado por rol en ruta compartida": "la UI ... MUST NOT
 * ofrecer una accion que el rol no puede ejecutar (aunque el backend la
 * rechace)").
 *
 * Centralized here (instead of inlined per-component) so a second UI
 * surface needing the same allow-list doesn't have to redeclare it — see
 * AGENTS.md "No repitas codigo".
 */

/**
 * Mirrors `DoctorAccessConfig::DELETE_ROLES` in
 * `backend/src/Infrastructure/Config/DoctorAccessConfig.php`. Kept separate
 * from doctor read/manage access since deletion affects shared directory
 * data used across the organization.
 */
const DOCTOR_DELETE_ROLES: readonly Role[] = ['org_admin']

export function canDeleteDoctor(role: Role | null | undefined): boolean {
  if (!role) return false
  return DOCTOR_DELETE_ROLES.includes(role)
}
