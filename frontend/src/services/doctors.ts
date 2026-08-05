import api from '@/services/api'
import { ApiResponse } from '@/types'
import { PaginatedData } from '@/types/backoffice'
import { Doctor, DoctorListParams, DoctorPayload, RepOption } from '@/types/doctor'

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

export function listDoctors(params: DoctorListParams) {
  return api.get<ApiResponse<PaginatedData<Doctor>>>(`/doctors${buildQuery(params)}`).then(unwrap)
}

export function searchDoctors(q: string) {
  return api.get<ApiResponse<Doctor[]>>(`/doctors/search${buildQuery({ q })}`).then(unwrap)
}

/**
 * Role-aware representative typeahead used by RepFilterSelect on the
 * /doctors filter bar. org_admin gets all org reps, manager gets only reps
 * actively subscribed to them; reps get 403 (they never see this filter).
 */
export function searchReps(q: string) {
  return api.get<ApiResponse<RepOption[]>>(`/doctors/reps/search${buildQuery({ q })}`).then(unwrap)
}

export function createDoctor(payload: DoctorPayload) {
  return api.post<ApiResponse<Doctor>>('/doctors', payload).then(unwrap)
}

export function updateDoctor(id: number, payload: Partial<DoctorPayload>) {
  return api.put<ApiResponse<Doctor>>(`/doctors/${id}`, payload).then(unwrap)
}

export function deleteDoctor(id: number) {
  return api.delete<ApiResponse<{ message: string }>>(`/doctors/${id}`).then(unwrap)
}
