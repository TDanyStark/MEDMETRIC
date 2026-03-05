import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/useAuth'

export function ProtectedRoute({ children, roles }) {
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

  return children
}
