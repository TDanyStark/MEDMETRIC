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

class MetricsService {
  async getMaterialViews() {
    return api.get<{ data: MaterialViewsMetric[] }>('/metrics/material-views')
  }

  async getRepLastLogin() {
    return api.get<{ data: RepLastLoginMetric[] }>('/metrics/rep-last-login')
  }

  async getTopMaterials(limit = 10) {
    return api.get<{ data: TopMaterialMetric[] }>(`/metrics/top-materials?limit=${limit}`)
  }
}

export const metricsApi = new MetricsService()
