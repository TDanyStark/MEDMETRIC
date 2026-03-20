export type Role = 'superadmin' | 'org_admin' | 'manager' | 'rep'

export interface User {
  id: number
  email: string
  name: string
  role: Role
  organization_id: number | null
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

export interface ApiErrorPayload {
  error?: {
    type?: string
    description?: string
  }
  message?: string
}

export interface PublicSession {
  id: number
  doctor_token: string
  doctor_name: string | null
  rep_name?: string | null
  notes: string | null
  created_at: string
}

export interface PublicMaterial {
  id: number
  title: string
  description: string | null
  cover_path: string | null
  cover_url?: string | null
  type: 'pdf' | 'video' | 'link'
  status: 'draft' | 'approved' | 'archived'
}

export interface PublicVisitPayload {
  session: PublicSession
  materials: PublicMaterial[]
  material_count: number
}

export interface MaterialResource {
  type: 'pdf' | 'video' | 'link'
  url?: string
  embed_url?: string | null
  title?: string
  description?: string | null
  redirect?: boolean
}
