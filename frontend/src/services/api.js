const API_BASE = '/api/v1'

class ApiService {
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`

    const token = localStorage.getItem('auth_token')

    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    }

    const config = {
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
      const err = new Error(message)
      err.status = response.status
      err.data = data
      throw err
    }

    return data
  }

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' })
  }

  post(endpoint, body) {
    return this.request(endpoint, { method: 'POST', body })
  }

  put(endpoint, body) {
    return this.request(endpoint, { method: 'PUT', body })
  }

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' })
  }
}

export const api = new ApiService()
export default api
