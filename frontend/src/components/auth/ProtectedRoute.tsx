import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/useAuth'
import { Role } from '../../types'

interface ProtectedRouteProps {
  children: ReactNode;
  roles?: Role[];
}

export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (roles && !roles.includes(user.role)) {
    // Redirect to their home
    const home = user.role === 'admin' ? '/admin' : user.role === 'manager' ? '/manager' : '/rep'
    return <Navigate to={home} replace />
  }

  return <>{children}</>
}
