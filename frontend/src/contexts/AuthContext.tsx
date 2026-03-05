import { useState, useCallback, ReactNode, useMemo } from 'react'
import api from '../services/api'
import { AuthContext } from './AuthContextValue'
import { ApiResponse, User } from '../types'

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

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(readStoredUser)

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    const res = await api.post<ApiResponse<{ token: string; user: User }>>('/auth/login', { email, password })
    const { token, user: userData } = res.data

    localStorage.setItem('auth_token', token)
    localStorage.setItem('auth_user', JSON.stringify(userData))
    setUser(userData)

    return userData
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    setUser(null)
  }, [])

  const value = useMemo(() => {
    return { user, login, logout }
  }, [user])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
