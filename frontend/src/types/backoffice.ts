import { Role } from '@/types'

export interface PaginatedData<T> {
  items: T[]
  total: number
  page: number
  per_page: number
  last_page: number
}

export interface RoleOption {
  id: number
  name: Role
}

export interface Organization {
  id: number
  name: string
  slug: string
  active: boolean
  timezone: string
  created_at: string
  updated_at: string
}

export interface AdminUser {
  id: number
  organization_id: number
  organization_name: string
  organization_timezone: string | null
  role_id: number
  role: Role
  name: string
  email: string
  active: boolean
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export interface Brand {
  id: number
  organization_id: number
  name: string
  description: string | null
  active: boolean
  created_at: string
  updated_at: string
  managers?: ManagerOption[]
}

export type MaterialType = 'pdf' | 'video' | 'link'
export type MaterialStatus = 'draft' | 'approved' | 'archived'

export interface Material {
  id: number
  organization_id: number
  brand_id: number
  manager_id: number
  title: string
  description: string | null
  cover_path: string | null
  cover_url?: string | null
  type: MaterialType
  status: MaterialStatus
  is_visible: boolean
  storage_driver: string
  storage_path: string | null
  external_url: string | null
  approved_at: string | null
  approved_by: number | null
  created_at: string
  updated_at: string
  brand_name?: string
  manager_name?: string
  studies?: MaterialStudy[]
}

export type MaterialStudyType = 'pdf' | 'link'

export interface MaterialStudy {
  id: number
  material_id: number
  title: string
  type: MaterialStudyType
  storage_driver?: string
  storage_path?: string | null
  external_url?: string | null
  pdf_compression_status?: 'pending' | 'compressed' | 'skipped' | 'failed' | 'unavailable' | null
  pdf_compression_error?: string | null
  pdf_compression_checked_at?: string | null
  view_count?: number
  created_at: string
  updated_at: string
}

/**
 * A study held only in local component state while its parent material is
 * still being created (no `material_id` exists yet). Flushed sequentially
 * against the real material id once the material create request succeeds.
 */
export interface PendingStudy {
  tempId: string
  title: string
  type: MaterialStudyType
  file?: File
  external_url?: string
}

export interface ManagerOption {
  id: number
  name: string
}

export interface BrandManagersResponse {
  brand_managers: ManagerOption[]
  org_managers: ManagerOption[]
  needs_selection: boolean
  needs_sync: boolean
}

export interface RepCandidate {
  id: number
  name: string
  email: string
}

export interface RepAccess {
  id: number
  rep_id: number
  manager_id: number
  active: boolean
  created_at: string
  updated_at: string
  rep: RepCandidate
}

export interface RepSubscription {
  manager_id: number
  manager_name: string
  manager_email: string
  active: boolean
}
