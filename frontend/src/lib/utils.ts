import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parseUTCDate(dateStr: string): Date {
  if (!dateStr) return new Date()
  
  let isoStr = dateStr
  // Convert "2024-03-20 14:00:00" to "2024-03-20T14:00:00Z"
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(isoStr)) {
    isoStr = isoStr.replace(' ', 'T') + 'Z'
  } else if (!isoStr.endsWith('Z') && !isoStr.match(/([-+]\d{2}:\d{2})$/)) {
    // If it's already an ISO string but missing the Z
    if (isoStr.includes('T')) {
      isoStr += 'Z'
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(isoStr)) {
      // Just a date without time, assume UTC midnight
      isoStr += 'T00:00:00Z'
    }
  }
  
  return new Date(isoStr)
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'

  return parseUTCDate(dateStr).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'

  return parseUTCDate(dateStr).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function getInitials(name: string = ''): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')
}

export function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
