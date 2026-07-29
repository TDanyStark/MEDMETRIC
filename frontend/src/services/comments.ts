import api from '@/services/api'
import { ApiResponse } from '@/types'
import {
  Comment,
  CommentCreatePayload,
  CommentListParams,
  CommentListResponse,
  PublicCommentCreatePayload,
} from '@/types/comment'

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

export function listComments(params: CommentListParams) {
  return api.get<ApiResponse<CommentListResponse>>(`/comments${buildQuery(params)}`).then(unwrap)
}

// Actual backend shape (CreateCommentAction::respondWithData($comment)): the
// freshly-created row's VisitSessionComment::jsonSerialize() — base fields
// only. can_delete/doctor_name/rep_name/material_title/author_name are
// enrichment fields only ever present on rows from listForScope(), never on
// a fresh create response, so they are omitted here (not optional-but-absent).
export type CommentCreateResponse = Omit<
  Comment,
  'can_delete' | 'doctor_name' | 'rep_name' | 'material_title' | 'author_name'
>

export function createComment(payload: CommentCreatePayload) {
  return api.post<ApiResponse<CommentCreateResponse>>('/comments', payload).then(unwrap)
}

// Actual backend shape (DeleteCommentAction::respondWithData(['deleted' => true])).
export function deleteComment(id: number) {
  return api.delete<ApiResponse<{ deleted: boolean }>>(`/comments/${id}`).then(unwrap)
}

// Actual backend shape (ListPublicCommentsAction::respondWithData(['items' => $comments])):
// an OBJECT wrapping the array under `items`, NOT a bare array. Unwrap here
// at the service boundary so every caller can rely on a plain Comment[]
// (this mismatch previously caused PublicOwnComments' `.map()` to throw
// `a.map is not a function` and white-screen the public doctor page).
export function getPublicComments(token: string) {
  return api
    .get<ApiResponse<{ items: Comment[] }>>(`/public/session/${token}/comments`)
    .then(unwrap)
    .then(data => data.items)
}

// Actual backend shape (CreatePublicCommentAction::respondWithData(['id' => ..., 'created_at' => ...])).
export type PublicCommentCreateResponse = Pick<Comment, 'id' | 'created_at'>

export function createPublicComment(token: string, payload: PublicCommentCreatePayload) {
  return api
    .post<ApiResponse<PublicCommentCreateResponse>>(`/public/session/${token}/comments`, payload)
    .then(unwrap)
}
