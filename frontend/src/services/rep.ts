import api from '@/services/api'
import { ApiResponse } from '@/types'
import { Material, PaginatedData, RepSession, RepSessionPayload, RepSessionResponse } from '@/types/rep'

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

export function listRepMaterials(params: { q?: string; type?: string; page?: number }) {
  return api.get<ApiResponse<PaginatedData<Material>>>(`/rep/materials${buildQuery(params)}`).then(unwrap)
}

export function createRepSession(payload: RepSessionPayload) {
  return api.post<ApiResponse<RepSessionResponse>>('/rep/visit-sessions', payload).then(unwrap)
}

export function listRepSessions(params: { page?: number }) {
  return api.get<ApiResponse<PaginatedData<RepSession>>>(`/rep/visit-sessions${buildQuery(params)}`).then(unwrap)
}
