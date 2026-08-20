import { MaterialType, PaginatedData } from './backoffice'

/**
 * Shapes mirror `App\Domain\RepMetrics\RepMetricsRepositoryInterface` and
 * the six `GET /rep/metrics/*` Actions EXACTLY (sdd/rep-metrics-module
 * Phase 4) — see `backend/src/Domain/RepMetrics/RepMetricsRepositoryInterface.php`
 * for the source of truth. Every field here is derived exclusively from the
 * authenticated rep's own `visit_sessions` (repId from JWT, never a query
 * param) and `viewer_type='doctor'` rows — no `ip_address`/`user_agent`
 * raw value is ever present (spec "Doctor Privacy").
 */

export interface RepMetricsSummary {
  sessions_total: number
  sessions_viewed: number
  /** Fraction 0..1 (already rounded server-side to 4 decimals), NOT a percent. */
  open_rate: number
  doctors_never_opened: number
  first_open_median_hours: number | null
  materials_opened: number
  materials_unopened: number
}

/**
 * One org-local calendar day. `sessions_created` and `sessions_viewed` are
 * TWO INDEPENDENT counts (never stacked — spec "Chart Data Correctness").
 * The backend always 0-fills every day in the effective range, so the
 * frontend never needs to gap-fill this array itself.
 */
export interface RepOpenTrendPoint {
  date: string
  sessions_created: number
  sessions_viewed: number
}

/** Always exactly 24 entries (0-23), 0-filled by the backend. */
export interface RepHourBucket {
  hour: number
  opens: number
}

export interface RepDeviceSplit {
  mobile: number
  desktop: number
}

export interface RepTopMaterial {
  id: number
  title: string
  type: MaterialType
  opens: number
  distinct_sessions: number
}

export type RepMetricSessionStatus = 'all' | 'viewed' | 'never'

export interface RepMetricSession {
  id: number
  doctor_name: string | null
  created_at: string
  viewed: boolean
  open_count: number
  first_open_at: string | null
  last_open_at: string | null
  /** Distinct org-local CALENDAR DAYS with >=1 doctor open, not open count. */
  revisit_days: number
  comment_count: number
}

export interface RepMetricsDateFilters {
  start_date?: string
  end_date?: string
}

/**
 * One (session, material) pair the rep sent that the doctor NEVER opened —
 * the per-material breakdown behind `RepMetricsSummary.materials_unopened`.
 * See `App\Domain\RepMetrics\RepMetricsRepositoryInterface::unopenedMaterials()`
 * for why this is a separate endpoint/table from `RepMetricSession`
 * ("médicos que nunca abrieron" is session-level; this is pair-level and
 * mostly NOT a subset of it — a session can appear here for one material
 * while the doctor opened others in that same session).
 */
export interface RepUnopenedMaterial {
  session_id: number
  doctor_name: string | null
  material_id: number
  material_title: string
  material_type: MaterialType
  sent_at: string
  days_elapsed: number
}

export { type PaginatedData }
