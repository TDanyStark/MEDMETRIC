import { useState } from 'react'

/**
 * Render-time equivalent of a `useEffect(fn, deps)` dependency array,
 * used to run "reset/sync local state when some value changes" logic
 * *during render* instead of in an effect.
 *
 * Why: `react-hooks/set-state-in-effect` (eslint-plugin-react-hooks v7,
 * part of `flat.recommended`) flags calling `setState` synchronously
 * inside a `useEffect` body, because doing so triggers an extra
 * effect-after-commit render (React commits with stale state, then the
 * effect fires and re-renders). React's own docs recommend adjusting
 * state *while rendering* instead for exactly this "reset/derive state
 * when a prop/value changes" pattern — see
 * https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
 *
 * Calling `setState` during render is officially supported by React:
 * when the new state differs from current state, React immediately
 * re-renders with the new value *before* committing/painting — so there
 * is no extra flash, no cascading effect, and no behavior difference
 * versus what a `useEffect` reset would eventually produce, minus the
 * wasted intermediate render.
 *
 * Usage:
 * ```tsx
 * if (useDidDepsChange([open, editingItem])) {
 *   if (open) setForm(editingItem ? toFormState(editingItem) : emptyForm)
 * }
 * ```
 *
 * Deps are compared with `Object.is` (===), exactly like a `useEffect`
 * dependency array — pass primitives or stable references.
 *
 * Fires on the FIRST render too, exactly like `useEffect(fn, deps)` does on
 * mount. This matters whenever the deps can already hold their final value
 * at mount time — e.g. a TanStack Query that resolves from cache, so the
 * component mounts with `data` already present and no later transition ever
 * happens. Seeding `prevDeps` with the first-render deps (the previous
 * behaviour) silently skipped the sync in exactly that case: the state was
 * hydrated on a cold visit but left at its initial value on every warm one.
 */
export function useDidDepsChange(deps: readonly unknown[]): boolean {
  // `null` is the "never compared yet" sentinel; a deps array is never null,
  // so this can't collide with a legitimate previous value.
  const [prevDeps, setPrevDeps] = useState<readonly unknown[] | null>(null)

  const changed =
    prevDeps === null ||
    deps.length !== prevDeps.length ||
    deps.some((dep, index) => !Object.is(dep, prevDeps[index]))

  if (changed) {
    setPrevDeps(deps)
  }

  return changed
}
