import { useEffect, lazy, Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { TooltipProvider } from './components/ui/tooltip'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { LegacyRedirect } from './components/routing/LegacyRedirect'
import { AppLayout } from './components/layout/AppLayout'
import { ErrorBoundary } from './components/error/ErrorBoundary'
import { PublicErrorFallback } from './components/error/PublicErrorFallback'
import { useAuth } from './contexts/useAuth'
import { APP_ROUTES, type RouteDef } from './lib/routes'
import { Loader2 } from 'lucide-react'

// Lazy loaded pages
const LoginPage = lazy(() => import('./pages/LoginPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))
const PublicVisitPage = lazy(() => import('./pages/public/PublicVisitPage'))
const PublicErrorPage = lazy(() => import('./pages/public/PublicErrorPage'))

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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster position="top-right" richColors closeButton />
        <BrowserRouter>
          <SessionBootstrap />
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route
                path="/login"
                element={<LoginPage />}
              />
              <Route
                path="/public/visit/:token"
                element={
                  <ErrorBoundary fallback={reset => <PublicErrorFallback onRetry={reset} />}>
                    <PublicVisitPage />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/public/error"
                element={
                  <ErrorBoundary fallback={reset => <PublicErrorFallback onRetry={reset} />}>
                    <PublicErrorPage />
                  </ErrorBoundary>
                }
              />

              {/* Rutas neutras (sin prefijo de rol) — fuente unica: APP_ROUTES. */}
              {APP_ROUTES.map(route => (
                <Route
                  key={route.path}
                  path={route.path}
                  element={
                    <ProtectedRoute roles={[...route.roles]}>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={route.element} />
                </Route>
              ))}

              {/* Redirects legacy (paths viejos con prefijo -> path neutro), derivados de APP_ROUTES.legacy. */}
              {APP_ROUTES.flatMap(route =>
                ((route as RouteDef).legacy ?? []).map(legacyPath => (
                  <Route key={legacyPath} path={legacyPath} element={<LegacyRedirect to={route.path} />} />
                )),
              )}

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  )
}

export default App
