import { useQuery } from '@tanstack/react-query'

import { CustomSelect } from '@/components/ui/CustomSelect'
import { listTimezones } from '@/services/backoffice'

interface TimezoneOption {
  label: string
  value: string
}

interface TimezoneSelectProps {
  value: string | null
  onChange: (timezone: string | null) => void
  label?: string
  required?: boolean
  instanceId?: string
}

/**
 * Timezone selector backed by GET /v1/timezones (the curated LATAM
 * allow-list). This is the ONLY place the frontend reads the zone list —
 * it must never be hardcoded elsewhere, or the backend/frontend lists
 * silently drift apart.
 */
export function TimezoneSelect({ value, onChange, label = 'Zona horaria', required, instanceId = 'timezone-select' }: TimezoneSelectProps) {
  const timezonesQuery = useQuery({
    queryKey: ['timezones'],
    queryFn: listTimezones,
    staleTime: Infinity,
  })

  const options: TimezoneOption[] = (timezonesQuery.data ?? []).map(zone => ({ label: zone, value: zone }))

  return (
    <CustomSelect<TimezoneOption>
      label={label}
      instanceId={instanceId}
      placeholder="Selecciona una zona horaria"
      value={value ? { label: value, value } : null}
      onChange={option => onChange(option ? option.value : null)}
      options={options}
      isLoading={timezonesQuery.isLoading}
      required={required}
    />
  )
}
