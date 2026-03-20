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

class MetricsService {
  async getMaterialViews() {
    return api.get<{ data: MaterialViewsMetric[] }>('/metrics/material-views')
  }

  async getMaterialViewsList(filters?: { material_id?: number; start_date?: string; end_date?: string; page?: number }) {
    const params = new URLSearchParams()
    if (filters?.material_id) params.append('material_id', filters.material_id.toString())
    if (filters?.start_date) params.append('start_date', filters.start_date)
    if (filters?.end_date) params.append('end_date', filters.end_date)
    if (filters?.page) params.append('page', filters.page.toString())
    
    return api.get<{ data: PaginatedData<MaterialViewListMetric> }>(`/metrics/material-views-list?${params.toString()}`)
  }

  async getRepLastLogin() {
    return api.get<{ data: RepLastLoginMetric[] }>('/metrics/rep-last-login')
  }

  async getTopMaterials(limit = 10, filters?: { q?: string; start_date?: string; end_date?: string; material_id?: number }) {
    const params = new URLSearchParams()
    params.append('limit', limit.toString())
    if (filters?.q) params.append('q', filters.q)
    if (filters?.start_date) params.append('start_date', filters.start_date)
    if (filters?.end_date) params.append('end_date', filters.end_date)
    if (filters?.material_id) params.append('material_id', filters.material_id.toString())

    return api.get<{ data: TopMaterialMetric[] }>(`/metrics/top-materials?${params.toString()}`)
  }
}

export const metricsApi = new MetricsService()
