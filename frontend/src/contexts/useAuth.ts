import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import api from '../services/api'
import { ApiResponse, User } from '../types'

interface AuthState {
  user: User | null;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
}

function readStoredUser(): User | null {
  try {
    const token = localStorage.getItem('auth_token')
    const stored = localStorage.getItem('auth_user')
    if (token && stored) return JSON.parse(stored)
  } catch {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
  }

  return null
}

export const useAuthStore = create<AuthState>((set) => ({
  user: readStoredUser(),
  login: async (email: string, password: string): Promise<User> => {
    const res = await api.post<ApiResponse<{ token: string; user: User }>>('/auth/login', { email, password })
    const { token, user: userData } = res.data

    localStorage.setItem('auth_token', token)
    localStorage.setItem('auth_user', JSON.stringify(userData))
    set({ user: userData })

    return userData
  },
  logout: () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    set({ user: null })
  },
}))

export function useAuth() {
  return useAuthStore(
    useShallow((state) => ({
      user: state.user,
      login: state.login,
      logout: state.logout,
    }))
  )
}
