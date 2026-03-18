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
  created_at: string
  updated_at: string
}

export interface AdminUser {
  id: number
  organization_id: number
  organization_name: string
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
  storage_driver: string
  storage_path: string | null
  external_url: string | null
  approved_at: string | null
  approved_by: number | null
  created_at: string
  updated_at: string
  brand_name?: string
  manager_name?: string
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
