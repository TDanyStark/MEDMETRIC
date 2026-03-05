import { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { AppLayout } from './components/layout/AppLayout'
import { useAuth } from './contexts/useAuth'
import { getRoleHome } from './lib/auth'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import PublicVisitPage from './pages/PublicVisitPage'
import RoleHomePage from './pages/RoleHomePage'
import RoleSectionPage from './pages/RoleSectionPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

function SessionBootstrap() {
  const { syncSession } = useAuth()

  useEffect(() => {
    if (window.localStorage.getItem('auth_token')) {
      void syncSession()
    }
  }, [syncSession])

  return null
}

function HomeRedirect() {
  const { user, isBootstrapping } = useAuth()

  if (isBootstrapping) {
    return null
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <Navigate to={getRoleHome(user.role)} replace />
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-right" richColors closeButton />
      <BrowserRouter>
        <SessionBootstrap />
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/public/visit/:token" element={<PublicVisitPage />} />

          <Route
            path="/superadmin"
            element={
              <ProtectedRoute roles={['superadmin']}>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<RoleHomePage role="superadmin" />} />
            <Route path="organizations" element={<RoleSectionPage role="superadmin" path="/superadmin/organizations" />} />
            <Route path="org-admins" element={<RoleSectionPage role="superadmin" path="/superadmin/org-admins" />} />
            <Route path="metrics" element={<RoleSectionPage role="superadmin" path="/superadmin/metrics" />} />
          </Route>

          <Route
            path="/org-admin"
            element={
              <ProtectedRoute roles={['org_admin']}>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<RoleHomePage role="org_admin" />} />
            <Route path="users" element={<RoleSectionPage role="org_admin" path="/org-admin/users" />} />
            <Route path="brands" element={<RoleSectionPage role="org_admin" path="/org-admin/brands" />} />
            <Route path="assignments" element={<RoleSectionPage role="org_admin" path="/org-admin/assignments" />} />
          </Route>

          <Route
            path="/manager"
            element={
              <ProtectedRoute roles={['manager']}>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<RoleHomePage role="manager" />} />
            <Route path="brands" element={<RoleSectionPage role="manager" path="/manager/brands" />} />
            <Route path="materials" element={<RoleSectionPage role="manager" path="/manager/materials" />} />
            <Route path="reps" element={<RoleSectionPage role="manager" path="/manager/reps" />} />
          </Route>

          <Route
            path="/rep"
            element={
              <ProtectedRoute roles={['rep']}>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<RoleHomePage role="rep" />} />
            <Route path="library" element={<RoleSectionPage role="rep" path="/rep/library" />} />
            <Route path="sessions" element={<RoleSectionPage role="rep" path="/rep/sessions" />} />
            <Route path="history" element={<RoleSectionPage role="rep" path="/rep/history" />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
