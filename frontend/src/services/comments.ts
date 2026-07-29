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

export function createComment(payload: CommentCreatePayload) {
  return api.post<ApiResponse<Comment>>('/comments', payload).then(unwrap)
}

export function deleteComment(id: number) {
  return api.delete<ApiResponse<{ message: string }>>(`/comments/${id}`).then(unwrap)
}

export function getPublicComments(token: string) {
  return api.get<ApiResponse<Comment[]>>(`/public/session/${token}/comments`).then(unwrap)
}

export function createPublicComment(token: string, payload: PublicCommentCreatePayload) {
  return api.post<ApiResponse<Comment>>(`/public/session/${token}/comments`, payload).then(unwrap)
}
