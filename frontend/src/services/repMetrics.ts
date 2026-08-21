import api from '@/services/api'
import { ApiResponse } from '@/types'
import { PaginatedData } from '@/types/backoffice'
import {
  RepDeviceSplit,
  RepHourBucket,
  RepMetricSession,
  RepMetricSessionStatus,
  RepMetricsSummary,
  RepNeverOpenedDoctor,
  RepOpenTrendPoint,
  RepTopMaterial,
  RepUnopenedMaterial,
} from '@/types/repMetrics'

/**
 * Client for the six `GET /rep/metrics/*` endpoints (sdd/rep-metrics-module
 * Phase 4). Mirrors the `buildQuery`/`unwrap` pattern already established
 * in `services/rep.ts` — no new HTTP conventions introduced.
 *
 * `repId` is NEVER a param here: every endpoint derives it exclusively from
 * the caller's JWT server-side (spec "Rep Data Isolation"). Only narrowing
 * filters (dates, q, status, page) are accepted.
 */
function buildQuery(params: Record<string, string | number | boolean | null | undefined>) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') query.set(key, String(value))
  })
  const queryString = query.toString()
  return queryString ? `?${queryString}` : ''
}

function unwrap<T>(response: ApiResponse<T>): T {
  return response.data
}

export type RepMetricsDateParams = {
  start_date?: string
  end_date?: string
}

export function getRepMetricsSummary(params: RepMetricsDateParams) {
  return api
    .get<ApiResponse<RepMetricsSummary>>(`/rep/metrics/summary${buildQuery(params)}`)
    .then(unwrap)
}

export function getRepOpenTrend(params: RepMetricsDateParams) {
  return api
    .get<ApiResponse<RepOpenTrendPoint[]>>(`/rep/metrics/open-trend${buildQuery(params)}`)
    .then(unwrap)
}

export function getRepHourHistogram(params: RepMetricsDateParams) {
  return api
    .get<ApiResponse<RepHourBucket[]>>(`/rep/metrics/hour-histogram${buildQuery(params)}`)
    .then(unwrap)
}

export function getRepDeviceSplit(params: RepMetricsDateParams) {
  return api
    .get<ApiResponse<RepDeviceSplit>>(`/rep/metrics/device-split${buildQuery(params)}`)
    .then(unwrap)
}

export function listRepTopMaterials(
  params: RepMetricsDateParams & { page?: number; q?: string },
) {
  return api
    .get<ApiResponse<PaginatedData<RepTopMaterial>>>(`/rep/metrics/top-materials${buildQuery(params)}`)
    .then(unwrap)
}

export function listRepMetricSessions(
  params: RepMetricsDateParams & {
    page?: number
    q?: string
    status?: RepMetricSessionStatus
    session_id?: number
    material_id?: number
  },
) {
  return api
    .get<ApiResponse<PaginatedData<RepMetricSession>>>(`/rep/metrics/sessions${buildQuery(params)}`)
    .then(unwrap)
}

export function listRepUnopenedMaterials(params: RepMetricsDateParams & { page?: number }) {
  return api
    .get<ApiResponse<PaginatedData<RepUnopenedMaterial>>>(
      `/rep/metrics/unopened-materials${buildQuery(params)}`,
    )
    .then(unwrap)
}

/**
 * "Médicos que nunca abrieron" — one row per DISTINCT doctor (deduped by
 * `doctor_id`, fix sdd/group-by-id-not-name). Replaces the previous
 * `listRepMetricSessions({ status: 'never' })` call, which returned
 * session-level rows keyed by the ambiguous `doctor_name` text.
 */
export function listRepNeverOpenedDoctors(
  params: RepMetricsDateParams & { page?: number; q?: string },
) {
  return api
    .get<ApiResponse<PaginatedData<RepNeverOpenedDoctor>>>(
      `/rep/metrics/never-opened-doctors${buildQuery(params)}`,
    )
    .then(unwrap)
}
