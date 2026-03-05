import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from './components/ui/Toast'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { AppLayout } from './components/layout/AppLayout'

import LoginPage         from './pages/LoginPage'
import AdminDashboard    from './pages/admin/AdminDashboard'
import OrganizationsPage from './pages/admin/OrganizationsPage'
import UsersPage         from './pages/admin/UsersPage'
import NotFoundPage      from './pages/NotFoundPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
              {/* Public */}
              <Route path="/login" element={<LoginPage />} />

              {/* Admin routes */}
              <Route
                element={
                  <ProtectedRoute roles={['admin']}>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/admin"               element={<AdminDashboard />} />
                <Route path="/admin/organizations" element={<OrganizationsPage />} />
                <Route path="/admin/users"         element={<UsersPage />} />
              </Route>

              {/* Manager routes (placeholder for Phase 4) */}
              <Route
                path="/manager/*"
                element={
                  <ProtectedRoute roles={['manager']}>
                    <div className="flex items-center justify-center h-screen text-sm text-slate-500">
                      Módulo Gerente — próximamente (Fase 4)
                    </div>
                  </ProtectedRoute>
                }
              />

              {/* Rep routes (placeholder for Phase 5) */}
              <Route
                path="/rep/*"
                element={
                  <ProtectedRoute roles={['rep']}>
                    <div className="flex items-center justify-center h-screen text-sm text-slate-500">
                      Módulo Visitador — próximamente (Fase 5)
                    </div>
                  </ProtectedRoute>
                }
              />

              {/* Root redirect */}
              <Route path="/" element={<Navigate to="/login" replace />} />

              {/* 404 */}
              <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}

export default App
