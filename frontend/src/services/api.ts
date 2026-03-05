import { ApiErrorPayload } from '@/types'

const API_BASE = '/api/v1'

interface RequestOptions extends RequestInit {
  body?: BodyInit | FormData | object | null
}

export class ApiRequestError extends Error {
  status: number
  data?: ApiErrorPayload | unknown

  constructor(message: string, status: number, data?: ApiErrorPayload | unknown) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.data = data
  }
}

function getStoredToken(): string | null {
  return window.localStorage.getItem('auth_token')
}

function extractErrorMessage(data: ApiErrorPayload | unknown, status: number): string {
  if (typeof data === 'object' && data !== null) {
    const payload = data as ApiErrorPayload
    return payload.error?.description ?? payload.message ?? `HTTP error ${status}`
  }

  return `HTTP error ${status}`
}

class ApiService {
  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const url = `${API_BASE}${endpoint}`
    const headers = new Headers(options.headers)
    const token = getStoredToken()

    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }

    const config: RequestInit = {
      ...options,
      headers,
    }

    if (options.body instanceof FormData) {
      config.body = options.body
    } else if (options.body !== undefined && options.body !== null) {
      headers.set('Content-Type', 'application/json')
      config.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body)
    }

    const response = await fetch(url, config)
    const contentType = response.headers.get('content-type') ?? ''

    let data: unknown = null
    if (contentType.includes('application/json')) {
      data = await response.json()
    } else if (contentType.includes('text/')) {
      data = await response.text()
    }

    if (!response.ok) {
      throw new ApiRequestError(extractErrorMessage(data, response.status), response.status, data)
    }

    return data as T
  }

  get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' })
  }

  post<T>(endpoint: string, body?: RequestOptions['body']): Promise<T> {
    return this.request<T>(endpoint, { method: 'POST', body })
  }

  put<T>(endpoint: string, body?: RequestOptions['body']): Promise<T> {
    return this.request<T>(endpoint, { method: 'PUT', body })
  }

  delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }
}

export const api = new ApiService()

export default api
