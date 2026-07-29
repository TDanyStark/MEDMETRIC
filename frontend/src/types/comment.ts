export type CommentAuthorType = 'doctor' | 'rep'

export interface Comment {
  id: number
  visit_session_id: number
  material_id: number | null
  organization_id: number
  author_type: CommentAuthorType
  author_user_id: number | null
  doctor_id: number | null
  body: string
  user_agent: string | null
  ip_address: string | null
  active: boolean
  created_at: string
  updated_at: string | null
  can_delete: boolean
  doctor_name: string | null
  rep_name: string | null
  material_title: string | null
  author_name: string | null
}

export type CommentListParams = {
  rep_id?: number
  doctor_id?: number
  material_id?: number
  has_material?: boolean
  date_from?: string
  date_to?: string
  q?: string
  page?: number
}

export interface CommentListResponse {
  items: Comment[]
  total: number
  page: number
  per_page: number
  last_page: number
}

export interface CommentCreatePayload {
  visit_session_id: number
  body: string
  material_id?: number
}

export interface PublicCommentCreatePayload {
  body: string
  material_id?: number
}
