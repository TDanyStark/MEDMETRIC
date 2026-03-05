import api from '@/services/api'
import { ApiResponse } from '@/types'
import {
  AdminUser,
  Brand,
  Material,
  Organization,
  PaginatedData,
  RepAccess,
  RepCandidate,
  RepSubscription,
  RoleOption,
} from '@/types/backoffice'

type QueryValue = string | number | boolean | null | undefined

function buildQuery(params: Record<string, QueryValue>) {
  const query = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') {
      return
    }

    query.set(key, String(value))
  })

  const queryString = query.toString()
  return queryString ? `?${queryString}` : ''
}

function unwrap<T>(response: ApiResponse<T>): T {
  return response.data
}

export function listOrganizations(params: { q?: string; page?: number }) {
  return api.get<ApiResponse<PaginatedData<Organization>>>(`/superadmin/organizations${buildQuery(params)}`).then(unwrap)
}

export function createOrganization(payload: { name: string; slug: string; active: boolean }) {
  return api.post<ApiResponse<Organization>>('/superadmin/organizations', payload).then(unwrap)
}

export function updateOrganization(id: number, payload: Partial<{ name: string; slug: string; active: boolean }>) {
  return api.put<ApiResponse<Organization>>(`/superadmin/organizations/${id}`, payload).then(unwrap)
}

export function listOrgAdmins(params: { organization_id?: number | null; q?: string; page?: number }) {
  return api.get<ApiResponse<PaginatedData<AdminUser>>>(`/superadmin/org-admins${buildQuery(params)}`).then(unwrap)
}

export function createOrgAdmin(payload: { name: string; email: string; password: string; organization_id: number; active: boolean }) {
  return api.post<ApiResponse<AdminUser>>('/superadmin/org-admins', payload).then(unwrap)
}

export function updateOrgAdmin(
  id: number,
  payload: Partial<{ name: string; email: string; password: string; organization_id: number; active: boolean }>,
) {
  return api.put<ApiResponse<AdminUser>>(`/superadmin/org-admins/${id}`, payload).then(unwrap)
}

export function listRoles(scope: 'superadmin' | 'org-admin') {
  const path = scope === 'superadmin' ? '/superadmin/roles' : '/org-admin/roles'
  return api.get<ApiResponse<RoleOption[]>>(path).then(unwrap)
}

export function listOrgUsers(params: { role?: string; q?: string; page?: number }) {
  return api.get<ApiResponse<PaginatedData<AdminUser>>>(`/org-admin/users${buildQuery(params)}`).then(unwrap)
}

export function createOrgUser(payload: {
  name: string
  email: string
  password: string
  role_id: number
  active: boolean
}) {
  return api.post<ApiResponse<AdminUser>>('/org-admin/users', payload).then(unwrap)
}

export function updateOrgUser(
  id: number,
  payload: Partial<{ name: string; email: string; password: string; active: boolean }>,
) {
  return api.put<ApiResponse<AdminUser>>(`/org-admin/users/${id}`, payload).then(unwrap)
}

export function getRepSubscriptions(id: number) {
  return api.get<ApiResponse<RepSubscription[]>>(`/org-admin/users/${id}/subscriptions`).then(unwrap)
}

export function updateRepSubscriptions(id: number, managerIds: number[]) {
  return api.put<ApiResponse<RepSubscription[]>>(`/org-admin/users/${id}/subscriptions`, { manager_ids: managerIds }).then(unwrap)
}

export function listOrgBrands(params: { q?: string; page?: number }) {
  return api.get<ApiResponse<PaginatedData<Brand>>>(`/org-admin/brands${buildQuery(params)}`).then(unwrap)
}

export function createOrgBrand(payload: { name: string; description: string; active?: boolean }) {
  return api.post<ApiResponse<Brand>>('/org-admin/brands', payload).then(unwrap)
}

export function updateOrgBrand(id: number, payload: Partial<{ name: string; description: string; active: boolean }>) {
  return api.put<ApiResponse<Brand>>(`/org-admin/brands/${id}`, payload).then(unwrap)
}

export function getManagerAssignedBrands(managerId: number, params: { q?: string; page?: number }) {
  return api.get<ApiResponse<PaginatedData<Brand>>>(`/org-admin/managers/${managerId}/brands${buildQuery(params)}`).then(unwrap)
}

export function assignBrandsToManager(managerId: number, brandIds: number[]) {
  return api.post<ApiResponse<{ assigned: number[]; errors: string[] }>>(`/org-admin/managers/${managerId}/brands`, {
    brand_ids: brandIds,
  }).then(unwrap)
}

export function removeBrandsFromManager(managerId: number, brandIds: number[]) {
  return api.delete<ApiResponse<{ removed: number[]; errors: string[] }>>(`/org-admin/managers/${managerId}/brands`, {
    brand_ids: brandIds,
  }).then(unwrap)
}

export function listManagerBrands(params: { q?: string; page?: number }) {
  return api.get<ApiResponse<PaginatedData<Brand>>>(`/manager/brands${buildQuery(params)}`).then(unwrap)
}

export function listManagerMaterials(params: { q?: string; status?: string; type?: string; page?: number }) {
  return api.get<ApiResponse<PaginatedData<Material>>>(`/manager/materials${buildQuery(params)}`).then(unwrap)
}

export function createManagerMaterial(payload: FormData | {
  title: string
  description: string
  brand_id: number
  type: string
  external_url?: string
}) {
  return api.post<ApiResponse<Material>>('/manager/materials', payload).then(unwrap)
}

export function updateManagerMaterial(
  id: number,
  payload: FormData | Partial<{ title: string; description: string; brand_id: number; type: string; external_url: string }>,
) {
  return api.put<ApiResponse<Material>>(`/manager/materials/${id}`, payload).then(unwrap)
}

export function approveManagerMaterial(id: number) {
  return api.post<ApiResponse<Material>>(`/manager/materials/${id}/approve`).then(unwrap)
}

export function listManagerReps(params: { q?: string; active?: boolean | null; page?: number }) {
  return api.get<ApiResponse<PaginatedData<RepAccess>>>(`/manager/reps${buildQuery(params)}`).then(unwrap)
}

export function listAvailableManagerReps(params: { q?: string }) {
  return api.get<ApiResponse<RepCandidate[]>>(`/manager/reps/available${buildQuery(params)}`).then(unwrap)
}

export function assignManagerReps(repIds: number[]) {
  return api.post<ApiResponse<{ assigned: RepAccess[]; errors: string[] }>>('/manager/reps', { rep_ids: repIds }).then(unwrap)
}

export function removeManagerRep(repId: number) {
  return api.delete<ApiResponse<{ removed: number[]; errors: string[] }>>(`/manager/reps/${repId}`).then(unwrap)
}
