import { api } from './api'

export interface MaterialViewsMetric {
  date: string
  viewer_type: 'rep' | 'doctor'
  views: number
  sessions: number
}

export interface RepLastLoginMetric {
  id: number
  name: string
  email: string
  last_login_at: string | null
}

export interface TopMaterialMetric {
  id: number
  title: string
  type: 'pdf' | 'video' | 'link'
  total_views: number
  rep_views: number
  doctor_views: number
  unique_reps: number
}

export interface RepAdoptionMetric {
  rep_id: number
  name: string
  email: string
  last_login_at: string | null
  last_view_at: string | null
  total_views: number
  distinct_materials: number
  available_materials: number
  adoption_percent: number
}

export interface MaterialViewListMetric {
  id: number
  material_id: number
  material_title: string
  material_type: 'pdf' | 'video' | 'link'
  cover_path: string | null
  viewer_type: 'rep' | 'doctor'
  opened_at: string
  doctor_name: string | null
  rep_name: string | null
}

export interface PaginatedData<T> {
  items: T[]
  meta: {
    total: number
    page: number
    per_page: number
    last_page: number
  }
}

type IdFilter = number | number[]

interface BaseMetricFilters {
  material_id?: IdFilter
  rep_id?: IdFilter
  start_date?: string
  end_date?: string
}

/**
 * Append an id filter (single value or array) as a comma-separated query param.
 * Empty arrays / falsy values are skipped.
 */
function appendIds(params: URLSearchParams, key: string, value?: IdFilter) {
  if (value === undefined || value === null) return
  const list = (Array.isArray(value) ? value : [value]).filter((id) => id > 0)
  if (list.length === 0) return
  params.append(key, list.join(','))
}

class MetricsService {
  async getMaterialViews(filters?: BaseMetricFilters) {
    const params = new URLSearchParams()
    appendIds(params, 'material_id', filters?.material_id)
    appendIds(params, 'rep_id', filters?.rep_id)
    if (filters?.start_date) params.append('start_date', filters.start_date)
    if (filters?.end_date) params.append('end_date', filters.end_date)

    const qs = params.toString()
    return api.get<{ data: MaterialViewsMetric[] }>(`/metrics/material-views${qs ? `?${qs}` : ''}`)
  }

  async getMaterialViewsList(filters?: BaseMetricFilters & { page?: number }) {
    const params = new URLSearchParams()
    appendIds(params, 'material_id', filters?.material_id)
    appendIds(params, 'rep_id', filters?.rep_id)
    if (filters?.start_date) params.append('start_date', filters.start_date)
    if (filters?.end_date) params.append('end_date', filters.end_date)
    if (filters?.page) params.append('page', filters.page.toString())
    
    return api.get<{ data: PaginatedData<MaterialViewListMetric> }>(`/metrics/material-views-list?${params.toString()}`)
  }

  async getRepLastLogin() {
    return api.get<{ data: RepLastLoginMetric[] }>('/metrics/rep-last-login')
  }

  async getRepAdoption(filters?: { rep_id?: IdFilter; start_date?: string; end_date?: string }) {
    const params = new URLSearchParams()
    appendIds(params, 'rep_id', filters?.rep_id)
    if (filters?.start_date) params.append('start_date', filters.start_date)
    if (filters?.end_date) params.append('end_date', filters.end_date)

    const qs = params.toString()
    return api.get<{ data: RepAdoptionMetric[] }>(`/metrics/rep-adoption${qs ? `?${qs}` : ''}`)
  }

  async getTopMaterials(limit = 10, filters?: BaseMetricFilters & { q?: string }) {
    const params = new URLSearchParams()
    params.append('limit', limit.toString())
    if (filters?.q) params.append('q', filters.q)
    if (filters?.start_date) params.append('start_date', filters.start_date)
    if (filters?.end_date) params.append('end_date', filters.end_date)
    appendIds(params, 'material_id', filters?.material_id)
    appendIds(params, 'rep_id', filters?.rep_id)

    return api.get<{ data: TopMaterialMetric[] }>(`/metrics/top-materials?${params.toString()}`)
  }
}

export const metricsApi = new MetricsService()
