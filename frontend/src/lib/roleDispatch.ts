import { useAuth } from '@/contexts/useAuth'
import type { Role } from '@/types'

/**
 * Single source of truth for "what role should a dispatcher page render
 * for" — always `useAuth().user.role`, never the URL, a prop, or a default.
 * Returns `null` while unauthenticated (dispatcher should render nothing;
 * `ProtectedRoute` never lets this happen in practice, since it redirects
 * to `/login` before a dispatcher page mounts).
 *
 * Shared by the route-role-prefix-removal dispatchers (`MetricsPage`,
 * `BrandsPage`, `MaterialsPage`) so the auth-read/null-handling shape lives
 * in exactly one place. The actual role -> component `switch` stays in each
 * dispatcher file: `eslint-plugin-react-hooks`'s `static-components` rule
 * rejects resolving a JSX tag from an object/map lookup at render time (the
 * component reference must be statically analyzable), so a generic
 * "pick a component by role" helper isn't viable here — a plain `switch`
 * returning literal `<Component />` tags per case is the lint-safe idiom.
 * See `sdd/route-role-prefix-removal/spec`: "La UI no debe OFRECER acciones
 * que el rol no puede ejecutar" — an unmatched `case` in that `switch` MUST
 * `return null`, never fall through to the most permissive branch.
 */
export function useDispatchRole(): Role | null {
  const { user } = useAuth()
  return user?.role ?? null
}
