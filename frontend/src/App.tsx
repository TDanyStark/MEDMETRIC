import { useEffect, lazy, Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { TooltipProvider } from './components/ui/tooltip'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { AppLayout } from './components/layout/AppLayout'
import { useAuth } from './contexts/useAuth'
import { getRoleHome } from './lib/auth'
import { Loader2 } from 'lucide-react'

// Lazy loaded pages
const LoginPage = lazy(() => import('./pages/LoginPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))
const PublicVisitPage = lazy(() => import('./pages/public/PublicVisitPage'))
const PublicErrorPage = lazy(() => import('./pages/public/PublicErrorPage'))
const RoleHomePage = lazy(() => import('./pages/RoleHomePage'))

// Manager pages
const ManagerBrandsPage = lazy(() => import('./pages/manager/ManagerBrandsPage').then(m => ({ default: m.ManagerBrandsPage })))
const ManagerMaterialsPage = lazy(() => import('./pages/manager/ManagerMaterialsPage').then(m => ({ default: m.ManagerMaterialsPage })))
const ManagerRepsPage = lazy(() => import('./pages/manager/ManagerRepsPage').then(m => ({ default: m.ManagerRepsPage })))
const ManagerMetricsPage = lazy(() => import('./pages/manager/ManagerMetricsPage').then(m => ({ default: m.ManagerMetricsPage })))

// Rep pages
const RepLibraryPage = lazy(() => import('./pages/rep/RepLibraryPage').then(m => ({ default: m.RepLibraryPage })))
const RepHistoryPage = lazy(() => import('./pages/rep/RepHistoryPage').then(m => ({ default: m.RepHistoryPage })))

// Org Admin pages
const OrgAdminAssignmentsPage = lazy(() => import('./pages/org-admin/OrgAdminAssignmentsPage').then(m => ({ default: m.OrgAdminAssignmentsPage })))
const OrgAdminBrandsPage = lazy(() => import('./pages/org-admin/OrgAdminBrandsPage').then(m => ({ default: m.OrgAdminBrandsPage })))
const OrgAdminMetricsPage = lazy(() => import('./pages/org-admin/OrgAdminMetricsPage').then(m => ({ default: m.OrgAdminMetricsPage })))
const OrgAdminUsersPage = lazy(() => import('./pages/org-admin/OrgAdminUsersPage').then(m => ({ default: m.OrgAdminUsersPage })))

// Super Admin pages
const SuperAdminMetricsPage = lazy(() => import('./pages/superadmin/SuperAdminMetricsPage').then(m => ({ default: m.SuperAdminMetricsPage })))
const SuperAdminOrgAdminsPage = lazy(() => import('./pages/superadmin/SuperAdminOrgAdminsPage').then(m => ({ default: m.SuperAdminOrgAdminsPage })))
const SuperAdminOrganizationsPage = lazy(() => import('./pages/superadmin/SuperAdminOrganizationsPage').then(m => ({ default: m.SuperAdminOrganizationsPage })))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

function LoadingFallback() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground">Cargando...</p>
      </div>
    </div>
  )
}

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
    return <LoadingFallback />
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
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<HomeRedirect />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/public/visit/:token" element={<PublicVisitPage />} />
              <Route path="/public/error" element={<PublicErrorPage />} />

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
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  )
}

export default App
