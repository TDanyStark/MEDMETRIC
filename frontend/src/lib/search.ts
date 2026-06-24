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

/**
 * Read a comma-separated list of positive numbers from a query param.
 * Example: "?material_id=7,12,30" -> [7, 12, 30]
 */
export function getNumberArrayParam(searchParams: URLSearchParams, key: string): number[] {
  const raw = searchParams.get(key)
  if (!raw) {
    return []
  }

  const ids = raw
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value) && value > 0)

  return Array.from(new Set(ids))
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
