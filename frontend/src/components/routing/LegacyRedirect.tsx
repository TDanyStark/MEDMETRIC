import { Navigate, useLocation, useParams } from 'react-router-dom'
import { routePath, type AppPath } from '@/lib/routes'

interface LegacyRedirectProps {
  /** Path neutro (`AppPath`) al que debe redirigir el path viejo con prefijo de rol. */
  to: AppPath
}

/**
 * LEGACY-REDIRECT (transitorio, retirable en un cambio futuro — ver Fase 7 de
 * `sdd/route-role-prefix-removal`).
 *
 * Redirige un path viejo con prefijo de rol (ej. `/manager/reps`) a su
 * equivalente neutro (`/reps`), preservando query params (`location.search`)
 * y cualquier segmento dinamico (`:id`) via `useParams`.
 */
export function LegacyRedirect({ to }: LegacyRedirectProps) {
  const params = useParams()
  const location = useLocation()

  return (
    <Navigate
      to={{
        pathname: routePath(to, params),
        search: location.search,
      }}
      replace
    />
  )
}
