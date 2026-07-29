import { AlertCircle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'

interface PublicErrorFallbackProps {
  /** Resets the boundary's internal error state before reloading. */
  onRetry?: () => void
}

/**
 * Full-page fallback for the unauthenticated, doctor-facing `/public/*`
 * routes. The visitor has zero technical context and no login, so the copy
 * stays calm, non-technical, and in Spanish, and never exposes stack traces
 * or internal error details. Visually matches `PublicErrorPage` so a crash
 * doesn't look like a crash dump.
 */
export function PublicErrorFallback({ onRetry }: PublicErrorFallbackProps) {
  const handleRetry = () => {
    onRetry?.()
    window.location.reload()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-xl text-center border-destructive/20 shadow-2xl shadow-destructive/5 animate-in fade-in zoom-in duration-500">
        <CardContent className="p-8 sm:p-12">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-8">
            <AlertCircle className="h-10 w-10" />
          </div>

          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
            Algo no salió bien
          </h1>

          <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-muted-foreground/80">
            Tuvimos un problema al mostrar esta página. Por favor, intenta nuevamente.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              variant="outline"
              className="w-full sm:w-auto h-12 px-8 rounded-2xl"
              onClick={handleRetry}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reintentar
            </Button>
          </div>

          <p className="mt-8 text-xs text-muted-foreground/40 font-medium uppercase tracking-widest">
            MedMetric Systems
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
