import { useEffect, useState } from 'react'
import AsyncSelect from 'react-select/async'
import type { FormatOptionLabelMeta } from 'react-select'
import { metricsApi, type RepLastLoginMetric } from '@/services/metrics'
import { createMultiSelectStyles } from './multiSelectStyles'

interface Option {
  label: string
  value: number
  email?: string
}

interface MultiRepSelectProps {
  value: number[]
  onChange: (ids: number[]) => void
  placeholder?: string
  className?: string
  instanceId?: string
}

export function MultiRepSelect({
  value,
  onChange,
  placeholder = 'Buscar representantes...',
  className,
  instanceId = 'multi-rep-select',
}: MultiRepSelectProps) {
  const [reps, setReps] = useState<RepLastLoginMetric[]>([])

  // The in-scope rep list is small enough to load once and filter client-side.
  useEffect(() => {
    let cancelled = false
    metricsApi
      .getRepLastLogin()
      .then((res) => {
        if (!cancelled) setReps(res.data)
      })
      .catch((error) => console.error('Error fetching reps', error))
    return () => {
      cancelled = true
    }
  }, [])

  const loadOptions = async (inputValue: string): Promise<Option[]> => {
    const term = inputValue.trim().toLowerCase()
    return reps
      .filter(
        (r) =>
          !term ||
          r.name.toLowerCase().includes(term) ||
          r.email.toLowerCase().includes(term),
      )
      .map((r) => ({ label: r.name, value: r.id, email: r.email }))
  }

  const selectedOptions: Option[] = value.map((id) => {
    const rep = reps.find((r) => r.id === id)
    return { label: rep?.name ?? `#${id}`, value: id, email: rep?.email }
  })

  return (
    <AsyncSelect<Option, true>
      isMulti
      instanceId={instanceId}
      classNamePrefix="multi-rep-select"
      cacheOptions
      defaultOptions={reps.map((r) => ({ label: r.name, value: r.id, email: r.email }))}
      loadOptions={loadOptions}
      value={selectedOptions}
      onChange={(options) => {
        const next = options ?? []
        onChange(next.map((o) => o.value))
      }}
      placeholder={placeholder}
      className={className}
      styles={createMultiSelectStyles<Option>()}
      menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
      menuPosition="fixed"
      menuPlacement="auto"
      menuShouldScrollIntoView={false}
      maxMenuHeight={240}
      closeMenuOnSelect={false}
      formatOptionLabel={(option: Option, meta: FormatOptionLabelMeta<Option>) =>
        meta.context === 'menu' ? (
          <div className="flex flex-col">
            <span className="font-medium">{option.label}</span>
            {option.email && (
              <span className="text-xs text-muted-foreground">{option.email}</span>
            )}
          </div>
        ) : (
          option.label
        )
      }
      noOptionsMessage={() => 'No se encontraron representantes'}
      loadingMessage={() => 'Buscando...'}
    />
  )
}
