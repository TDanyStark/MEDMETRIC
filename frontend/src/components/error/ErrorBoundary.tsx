import { Component, ErrorInfo, ReactNode } from 'react'

export interface ErrorBoundaryProps {
  children: ReactNode
  /**
   * Rendered instead of `children` once a render-time error is caught.
   * Pass a function to receive a `reset` callback (clears the error and
   * re-attempts to render `children`).
   */
  fallback: ReactNode | ((reset: () => void) => ReactNode)
  /** Optional hook invoked right before the boundary resets its state. */
  onReset?: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
}

/**
 * Generic, reusable error boundary.
 *
 * IMPORTANT: React only supports error boundaries as CLASS components —
 * `getDerivedStateFromError` / `componentDidCatch` have no hook equivalent
 * (as of React 19). This is the one intentional, justified class component
 * in the codebase. Do NOT "modernize" this into a function component; doing
 * so would silently remove all render-crash protection across the app.
 *
 * Known limitation (be honest about this everywhere it's used): error
 * boundaries only catch errors thrown DURING RENDER of their child tree
 * (including class lifecycle methods and constructors). They do NOT catch:
 *   - errors inside event handlers (e.g. onClick)
 *   - errors in async code / promise rejections that happen outside render
 *   - errors during server-side rendering
 *   - errors thrown in the boundary's own render method
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Intentionally console.error only — no third-party error-reporting
    // dependency was added. This keeps the failure visible in devtools.
    console.error('[ErrorBoundary] Caught a render error:', error, errorInfo.componentStack)
  }

  reset = (): void => {
    this.props.onReset?.()
    this.setState({ hasError: false })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      const { fallback } = this.props
      return typeof fallback === 'function' ? fallback(this.reset) : fallback
    }

    return this.props.children
  }
}
