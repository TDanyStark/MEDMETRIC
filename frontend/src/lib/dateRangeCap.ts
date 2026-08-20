import { addDays, format, parseISO } from 'date-fns'
import { DEFAULT_METRICS_RANGE_DAYS, MAX_METRICS_TREND_DAYS } from './metricsTrendConfig'

const DATE_FORMAT = 'yyyy-MM-dd'

export interface CappedDateRange {
  startDate: string | null
  endDate: string | null
  wasCapped: boolean
}

export interface DefaultDateRange {
  startDate: string
  endDate: string
}

/**
 * The [startDate, endDate] pair the metrics date pickers pre-fill with
 * when the user hasn't chosen a filter yet: the last `days` calendar days
 * up to and including today, browser-local (same approximation already
 * used by `computeMinStartDate`/`computeMaxEndDate` below — an exact
 * org-local "today" would require plumbing the org timezone into every
 * caller just for a date-picker default; the backend independently
 * computes the authoritative org-local default via
 * `OrgDateRange::lastNLocalDays()` regardless of what this returns, so a
 * browser/org timezone mismatch can only shift the PRE-FILLED picker
 * value by at most a day at the boundary, never what data actually comes
 * back). NOT written to the URL by the caller — an absent `start_date`/
 * `end_date` keeps meaning "no explicit filter, use today's rolling
 * default", the same convention already used before this default existed
 * (previously "no filter" meant "full history"; freezing a relative
 * "last N days" into a shareable URL would make an old link silently
 * show a different window than the one the sharer saw).
 */
export function computeDefaultDateRange(days: number = DEFAULT_METRICS_RANGE_DAYS): DefaultDateRange {
  const end = new Date()
  const start = addDays(end, -(days - 1))
  return { startDate: format(start, DATE_FORMAT), endDate: format(end, DATE_FORMAT) }
}

/**
 * Earliest `start_date` ('YYYY-MM-DD') that will NOT be truncated by the
 * backend, given a (possibly absent) `endDate`. Mirrors
 * `OrgDateRange::capRangeToMaxDays()`'s "measure against endLocal, or
 * today when endLocal is absent" rule (see
 * backend/src/Infrastructure/Support/OrgDateRange.php) so the frontend
 * bound always agrees with what the backend will actually accept.
 */
export function computeMinStartDate(
  endDate: string | null | undefined,
  maxDays: number = MAX_METRICS_TREND_DAYS,
): string {
  const effectiveEnd = endDate ? parseISO(endDate) : new Date()
  return format(addDays(effectiveEnd, -(maxDays - 1)), DATE_FORMAT)
}

/**
 * Latest `end_date` ('YYYY-MM-DD') selectable without implying a range
 * wider than `maxDays`, given a chosen `startDate`. There is no backend
 * equivalent that bounds `end_date` directly (only `start_date` is ever
 * pulled forward — see OrgDateRange::capRangeToMaxDays), but constraining
 * it here too keeps both date-pickers mutually consistent and prevents the
 * user from picking a valid `start_date` and then widening `end_date`
 * past the cap. Returns `undefined` when there is no `startDate` to
 * measure against (no bound needed).
 */
export function computeMaxEndDate(
  startDate: string | null | undefined,
  maxDays: number = MAX_METRICS_TREND_DAYS,
): string | undefined {
  if (!startDate) return undefined
  return format(addDays(parseISO(startDate), maxDays - 1), DATE_FORMAT)
}

/**
 * Caps a [startDate, endDate] pair to at most `maxDays` days, truncating
 * `startDate` forward and preserving `endDate` exactly as given — the same
 * truncation direction/semantics as the backend's
 * `OrgDateRange::capRangeToMaxDays()`, so the UI never displays (or leaves
 * in the URL) a wider range than what the API will actually return.
 *
 * When neither date is set, this is a no-op: there is nothing on screen to
 * correct, and the backend's own unfiltered default window applies without
 * any misleading picker state to fix.
 */
export function capDateRangeToMaxDays(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  maxDays: number = MAX_METRICS_TREND_DAYS,
): CappedDateRange {
  const normalizedStart = startDate || null
  const normalizedEnd = endDate || null

  if (!normalizedStart && !normalizedEnd) {
    return { startDate: normalizedStart, endDate: normalizedEnd, wasCapped: false }
  }

  const minStart = computeMinStartDate(normalizedEnd, maxDays)

  if (!normalizedStart || normalizedStart < minStart) {
    return { startDate: minStart, endDate: normalizedEnd, wasCapped: true }
  }

  return { startDate: normalizedStart, endDate: normalizedEnd, wasCapped: false }
}
