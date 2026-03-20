import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import api from '../services/api'
import { ApiResponse, User } from '../types'

interface AuthState {
  user: User | null
  isBootstrapping: boolean
  login: (email: string, password: string) => Promise<User>
  logout: () => void
  syncSession: () => Promise<User | null>
  changePassword: (current_password: string, new_password: string) => Promise<void>
}

function normalizeUser(value: unknown): User | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const user = value as Partial<User>

  if (!user.id || !user.email || !user.name || !user.role) {
    return null
  }

  return {
    id: Number(user.id),
    email: String(user.email),
    name: String(user.name),
    role: user.role,
    organization_id:
      user.organization_id === null || user.organization_id === undefined
        ? null
        : Number(user.organization_id),
  }
}

function persistSession(token: string, user: User) {
  localStorage.setItem('auth_token', token)
  localStorage.setItem('auth_user', JSON.stringify(user))
}

function clearSession() {
  localStorage.removeItem('auth_token')
  localStorage.removeItem('auth_user')
}

function readStoredUser(): User | null {
  try {
    const token = localStorage.getItem('auth_token')
    const stored = localStorage.getItem('auth_user')
    if (token && stored) return normalizeUser(JSON.parse(stored))
  } catch {
    clearSession()
  }

  return null
}

export const useAuthStore = create<AuthState>((set) => ({
  user: readStoredUser(),
  isBootstrapping: false,
  login: async (email: string, password: string): Promise<User> => {
    const res = await api.post<ApiResponse<{ token: string; user: User }>>('/auth/login', { email, password })
    const { token } = res.data
    const userData = normalizeUser(res.data.user)

    if (!userData) {
      clearSession()
      throw new Error('No se pudo validar la sesion devuelta por el servidor.')
    }

    persistSession(token, userData)
    set({ user: userData, isBootstrapping: false })

    return userData
  },
  logout: () => {
    clearSession()
    set({ user: null, isBootstrapping: false })
  },
  syncSession: async () => {
    const token = localStorage.getItem('auth_token')

    if (!token) {
      clearSession()
      set({ user: null, isBootstrapping: false })
      return null
    }

    set({ isBootstrapping: true })

    try {
      const res = await api.get<ApiResponse<User>>('/auth/me')
      const user = normalizeUser(res.data)

      if (!user) {
        throw new Error('La sesion recibida no es valida.')
      }

      persistSession(token, user)
      set({ user, isBootstrapping: false })
      return user
    } catch {
      clearSession()
      set({ user: null, isBootstrapping: false })
      return null
    }
  },
  changePassword: async (current_password: string, new_password: string) => {
    await api.post('/auth/change-password', { current_password, new_password })
  },
}))

export function useAuth() {
  return useAuthStore(
    useShallow((state) => ({
      user: state.user,
      isBootstrapping: state.isBootstrapping,
      login: state.login,
      logout: state.logout,
      syncSession: state.syncSession,
      changePassword: state.changePassword,
    }))
  )
}
