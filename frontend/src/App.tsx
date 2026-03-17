import { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { TooltipProvider } from './components/ui/tooltip'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { AppLayout } from './components/layout/AppLayout'
import { useAuth } from './contexts/useAuth'
import { getRoleHome } from './lib/auth'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import { ManagerBrandsPage, ManagerMaterialsPage, ManagerRepsPage, ManagerMetricsPage } from './pages/manager/ManagerPages'
import { RepLibraryPage, RepHistoryPage } from './pages/rep/RepPages'
import { OrgAdminAssignmentsPage } from './pages/org-admin/OrgAdminAssignmentsPage'
import { OrgAdminBrandsPage } from './pages/org-admin/OrgAdminBrandsPage'
import { OrgAdminMetricsPage } from './pages/org-admin/OrgAdminMetricsPage'
import { OrgAdminUsersPage } from './pages/org-admin/OrgAdminUsersPage'
import PublicVisitPage from './pages/public/PublicVisitPage'
import RoleHomePage from './pages/RoleHomePage'
import { SuperAdminMetricsPage, SuperAdminOrgAdminsPage, SuperAdminOrganizationsPage } from './pages/superadmin/SuperAdminPages'

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
      <TooltipProvider>
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
              <Route path="organizations" element={<SuperAdminOrganizationsPage />} />
              <Route path="org-admins" element={<SuperAdminOrgAdminsPage />} />
              <Route path="metrics" element={<SuperAdminMetricsPage />} />
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
              <Route path="users" element={<OrgAdminUsersPage />} />
              <Route path="brands" element={<OrgAdminBrandsPage />} />
              <Route path="assignments" element={<OrgAdminAssignmentsPage />} />
              <Route path="metrics" element={<OrgAdminMetricsPage />} />
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
              <Route path="brands" element={<ManagerBrandsPage />} />
              <Route path="materials" element={<ManagerMaterialsPage />} />
              <Route path="reps" element={<ManagerRepsPage />} />
              <Route path="metrics" element={<ManagerMetricsPage />} />
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
              <Route path="library" element={<RepLibraryPage />} />
              <Route path="history" element={<RepHistoryPage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  )
}

export default App
