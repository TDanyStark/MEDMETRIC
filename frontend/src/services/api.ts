import { ApiErrorPayload } from '@/types'

const API_BASE = '/api/v1'

interface RequestOptions extends Omit<RequestInit, 'body'> {
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

const DEFAULT_FRIENDLY_ERROR_MESSAGE =
  'Ocurrió un error inesperado. Intenta de nuevo o contacta soporte si el problema persiste.'

// Matches technical/leaked backend error text (SQL errors, PHP exceptions, stack traces)
// that should never be shown to end users, even if the backend fails to sanitize it.
const TECHNICAL_ERROR_PATTERN =
  /SQLSTATE|PDOException|Fatal error|Stack trace|Trace:|Exception\b|at \w+\(.*\)/i

function looksLikeTechnicalMessage(message: string): boolean {
  if (!message) return true
  if (TECHNICAL_ERROR_PATTERN.test(message)) return true
  if (message.length > 200) return true
  if (/\r|\n/.test(message)) return true
  return false
}

/**
 * Returns a message safe to show to end users. Curated/friendly backend messages
 * (e.g. 409 conflict messages) are passed through as-is. Anything that looks like a
 * raw technical error (SQL error text, PHP exceptions, stack traces, unexpectedly
 * long/multi-line strings) is replaced with a generic Spanish fallback message.
 */
export function getUserFriendlyErrorMessage(
  error: unknown,
  fallback: string = DEFAULT_FRIENDLY_ERROR_MESSAGE,
): string {
  const message =
    error instanceof ApiRequestError || error instanceof Error ? error.message : null

  if (!message) return fallback

  return looksLikeTechnicalMessage(message) ? fallback : message
}

class ApiService {
  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const url = `${API_BASE}${endpoint}`
    const { body, ...requestInitOptions } = options
    const headers = new Headers(options.headers)
    const token = getStoredToken()

    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }

    const config: RequestInit = {
      ...requestInitOptions,
      headers,
    }

    if (body instanceof FormData) {
      config.body = body
    } else if (body !== undefined && body !== null) {
      headers.set('Content-Type', 'application/json')
      config.body = typeof body === 'string' ? body : JSON.stringify(body)
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

  delete<T>(endpoint: string, body?: RequestOptions['body']): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE', body })
  }

  patch<T>(endpoint: string, body?: RequestOptions['body']): Promise<T> {
    return this.request<T>(endpoint, { method: 'PATCH', body })
  }
}

export const api = new ApiService()

export default api
