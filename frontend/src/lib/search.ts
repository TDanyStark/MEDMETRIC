export function getStringParam(searchParams: URLSearchParams, key: string, fallback = ''): string {
  return searchParams.get(key) ?? fallback
}

export function getNumberParam(searchParams: URLSearchParams, key: string, fallback = 1): number {
  const value = Number(searchParams.get(key) ?? fallback)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export function getNullableNumberParam(searchParams: URLSearchParams, key: string): number | null {
  const rawValue = searchParams.get(key)
  if (!rawValue) {
    return null
  }

  const value = Number(rawValue)
  return Number.isFinite(value) && value > 0 ? value : null
}

export function getBooleanParam(searchParams: URLSearchParams, key: string): boolean | null {
  const value = searchParams.get(key)

  if (value === 'true') {
    return true
  }

  if (value === 'false') {
    return false
  }

  return null
}

export function updateSearchParams(
  current: URLSearchParams,
  updates: Record<string, string | number | boolean | null | undefined>,
): URLSearchParams {
  const next = new URLSearchParams(current)

  Object.entries(updates).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') {
      next.delete(key)
      return
    }

    next.set(key, String(value))
  })

  return next
}
