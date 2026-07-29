import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/ErrorState'

interface SectionErrorFallbackProps {
  message?: string
  onRetry?: () => void
}

/**
 * Small, inline fallback for a single section within a larger page (e.g. the
 * comments block on the public visit page). Reuses the existing
 * `ErrorState` primitive so a section crash reads as "this one block
 * couldn't load" rather than a full-page crash — the rest of the page
 * (e.g. the materials list) keeps rendering normally.
 */
export function SectionErrorFallback({
  message = 'No pudimos mostrar esta sección.',
  onRetry,
}: SectionErrorFallbackProps) {
  return (
    <div className="space-y-3">
      <ErrorState message={message} />
      {onRetry && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" className="rounded-full" onClick={onRetry}>
            Reintentar
          </Button>
        </div>
      )}
    </div>
  )
}
