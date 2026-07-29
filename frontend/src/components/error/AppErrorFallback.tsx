import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'

interface AppErrorFallbackProps {
  onRetry?: () => void
}

/**
 * Fallback for the authenticated app shell (superadmin/org-admin/manager/rep
 * routed content). Internal users get the same calm Spanish tone as the
 * public fallback, but it's acceptable to be slightly more explicit that
 * something failed and can be retried.
 */
export function AppErrorFallback({ onRetry }: AppErrorFallbackProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md text-center border-destructive/20 shadow-sm">
        <CardContent className="p-8 sm:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-6">
            <AlertTriangle className="h-8 w-8" />
          </div>

          <h2 className="font-display text-xl font-bold tracking-tight text-foreground">
            Ocurrió un error inesperado
          </h2>

          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Esta sección falló al cargar. Puedes intentar nuevamente; si el problema persiste,
            contacta a soporte.
          </p>

          <div className="mt-8 flex justify-center">
            <Button variant="outline" className="rounded-2xl" onClick={onRetry}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
