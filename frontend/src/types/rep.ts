import { Material, MaterialType, PaginatedData } from './backoffice'

export interface RepSession {
  id: number
  rep_id: number
  doctor_token: string
  doctor_id: number | null
  doctor_name: string | null
  notes: string | null
  created_at: string
  material_ids?: number[]
  /** Whether a doctor has opened >=1 material in this session (sdd/rep-metrics-module). */
  viewed: boolean
  /** Total doctor opens across the session (may exceed material_count on re-visits). */
  open_count: number
  /** Most recent doctor open, or null when never opened. */
  last_open_at: string | null
}

export interface RepSessionPayload {
  doctor_id: number
  /** @deprecated legacy field, no longer sent from the form */
  doctor_name?: string
  notes?: string
  material_ids: number[]
}

export interface RepSessionResponse {
  session: RepSession
  materials: Material[]
}

export { type PaginatedData, type Material, type MaterialType }
