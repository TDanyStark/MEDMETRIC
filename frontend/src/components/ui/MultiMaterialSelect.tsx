import { useEffect, useState } from 'react'
import AsyncSelect from 'react-select/async'
import { metricsApi } from '@/services/metrics'
import { multiSelectStyles } from './multiSelectStyles'

interface Option {
  label: string
  value: number
}

interface MultiMaterialSelectProps {
  value: number[]
  onChange: (ids: number[]) => void
  placeholder?: string
  className?: string
  instanceId?: string
}

export function MultiMaterialSelect({
  value,
  onChange,
  placeholder = 'Buscar materiales...',
  className,
  instanceId = 'multi-material-select',
}: MultiMaterialSelectProps) {
  // Cache of resolved labels so selected chips keep their title across searches.
  const [labelCache, setLabelCache] = useState<Record<number, string>>({})

  // Resolve labels for any selected id we don't have a label for yet.
  useEffect(() => {
    const missing = value.filter((id) => !labelCache[id])
    if (missing.length === 0) return

    let cancelled = false
    Promise.all(
      missing.map((id) =>
        metricsApi
          .getTopMaterials(1, { material_id: [id] })
          .then((res) => (res.data[0] ? { id, title: res.data[0].title } : null))
          .catch(() => null),
      ),
    ).then((results) => {
      if (cancelled) return
      const next: Record<number, string> = {}
      for (const r of results) {
        if (r) next[r.id] = r.title
      }
      if (Object.keys(next).length > 0) {
        setLabelCache((prev) => ({ ...prev, ...next }))
      }
    })

    return () => {
      cancelled = true
    }
  }, [value, labelCache])

  const loadOptions = async (inputValue: string): Promise<Option[]> => {
    try {
      const response = await metricsApi.getTopMaterials(30, { q: inputValue })
      // Warm the label cache so freshly searched items render with their title.
      setLabelCache((prev) => {
        const next = { ...prev }
        for (const m of response.data) next[m.id] = m.title
        return next
      })
      return response.data.map((m) => ({ label: m.title, value: m.id }))
    } catch (error) {
      console.error('Error fetching materials', error)
      return []
    }
  }

  const selectedOptions: Option[] = value.map((id) => ({
    label: labelCache[id] ?? `#${id}`,
    value: id,
  }))

  return (
    <AsyncSelect
      isMulti
      instanceId={instanceId}
      classNamePrefix="multi-material-select"
      cacheOptions
      defaultOptions
      loadOptions={loadOptions}
      value={selectedOptions}
      onChange={(options: any) => {
        const next = (options ?? []) as Option[]
        onChange(next.map((o) => o.value))
      }}
      placeholder={placeholder}
      className={className}
      styles={multiSelectStyles}
      menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
      menuPosition="fixed"
      menuPlacement="auto"
      menuShouldScrollIntoView={false}
      maxMenuHeight={240}
      closeMenuOnSelect={false}
      noOptionsMessage={() => 'No se encontraron materiales'}
      loadingMessage={() => 'Buscando...'}
    />
  )
}
