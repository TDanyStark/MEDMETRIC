import { useEffect, useState } from 'react'
import AsyncSelect from 'react-select/async'
import { toast } from 'sonner'
import { searchReps } from '@/services/doctors'
import { createAsyncSelectStyles } from './asyncSelectStyles'

interface Option {
  label: string
  value: string
}

interface RepFilterSelectProps {
  value: number | null
  onChange: (repId: number | null) => void
  placeholder?: string
  className?: string
  instanceId?: string
}

const ALL_REPS_OPTION: Option = { label: 'Todos los representantes', value: '' }

/**
 * Async single-select "Representative" filter for /doctors, replacing the
 * former static Region select + free-text Category input. Mirrors
 * AsyncMaterialSelect's structure/styling (cacheOptions + defaultOptions,
 * initial-value label hydration via a dedicated lookup call). Backed by the
 * role-aware GET /v1/doctors/reps/search endpoint — org_admin sees all org
 * reps, manager sees only their subscribed reps.
 */
export function RepFilterSelect({
  value,
  onChange,
  placeholder = 'Buscar representante...',
  className,
  instanceId,
}: RepFilterSelectProps) {
  const [initialOption, setInitialOption] = useState<Option | null>(null)

  // Hydrate the label for a rep_id that came from the URL (deep link/reload),
  // since react-select/async only knows labels for options it has loaded.
  useEffect(() => {
    if (value && (!initialOption || initialOption.value !== String(value))) {
      searchReps('')
        .then(reps => {
          const match = reps.find(rep => rep.id === value)
          if (match) {
            setInitialOption({ label: match.name, value: String(match.id) })
          }
        })
        .catch(() => {
          // Silent: the select simply shows the raw id until a fresh search resolves it.
        })
    } else if (!value) {
      setInitialOption(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const loadOptions = async (inputValue: string): Promise<Option[]> => {
    try {
      const reps = await searchReps(inputValue)
      return [ALL_REPS_OPTION, ...reps.map(rep => ({ label: rep.name, value: String(rep.id) }))]
    } catch (error) {
      console.error('Error fetching reps', error)
      toast.error('No se pudieron cargar los representantes.')
      return [ALL_REPS_OPTION]
    }
  }

  const customStyles = createAsyncSelectStyles<Option>()

  const selectedValue = value
    ? initialOption?.value === String(value)
      ? initialOption
      : null
    : ALL_REPS_OPTION

  return (
    <AsyncSelect
      instanceId={instanceId || 'rep-filter-select'}
      cacheOptions
      defaultOptions
      loadOptions={loadOptions}
      value={selectedValue}
      onChange={(option) => {
        setInitialOption(option)
        const nextValue = option?.value ? Number(option.value) : null
        onChange(nextValue)
      }}
      placeholder={placeholder}
      className={className}
      styles={customStyles}
      noOptionsMessage={() => 'No se encontraron representantes'}
      loadingMessage={() => 'Buscando...'}
    />
  )
}
