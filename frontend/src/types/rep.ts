import { Material, MaterialType, PaginatedData } from './backoffice'

export interface RepSession {
  id: number
  rep_id: number
  doctor_token: string
  doctor_name: string | null
  notes: string | null
  created_at: string
  material_ids?: number[]
}

export interface RepSessionPayload {
  doctor_name?: string
  notes?: string
  material_ids: number[]
}

export interface RepSessionResponse {
  session: RepSession
  materials: Material[]
}

export { type PaginatedData, type Material, type MaterialType }
