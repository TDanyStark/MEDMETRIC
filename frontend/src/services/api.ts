const API_BASE = '/api/v1'

interface RequestOptions extends RequestInit {
  body?: any;
}

class ApiService {
  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const url = `${API_BASE}${endpoint}`

    const token = localStorage.getItem('auth_token')

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string>),
    }

    const config: RequestInit = {
      ...options,
      headers,
    }

    if (options.body && typeof options.body === 'object') {
      config.body = JSON.stringify(options.body)
    }

    const response = await fetch(url, config)
    const data = await response.json()

    if (!response.ok) {
      const message = data?.error?.description || data?.message || `HTTP error ${response.status}`
      const err = new Error(message) as any
      err.status = response.status
      err.data = data
      throw err
    }

    return data as T
  }

  get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' })
  }

  post<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, { method: 'POST', body })
  }

  put<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, { method: 'PUT', body })
  }

  delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }
}

export const api = new ApiService()
export default api
