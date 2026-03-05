import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { ApiResponse, Organization, PaginatedResult } from '../types'

const QUERY_KEY = ['organizations']

interface OrgFilters {
  q?: string;
  page?: number;
}

export function useOrganizations(filters: OrgFilters = {}) {
  const params = new URLSearchParams()
  if (filters.q)    params.set('q',    filters.q)
  if (filters.page) params.set('page', String(filters.page))
  const qs = params.toString() ? `?${params}` : ''

  return useQuery({
    queryKey: [...QUERY_KEY, filters],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PaginatedResult<Organization>>>(`/admin/organizations${qs}`)
      return res.data
    },
  })
}

export function useCreateOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Organization>) => api.post<ApiResponse<Organization>>('/admin/organizations', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useUpdateOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Organization> & { id: number }) => 
      api.put<ApiResponse<Organization>>(`/admin/organizations/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}
