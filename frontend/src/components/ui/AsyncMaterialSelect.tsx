import { useState, useEffect } from 'react'
import AsyncSelect from 'react-select/async'
import { metricsApi } from '@/services/metrics'

interface Option {
  label: string
  value: string
}

interface AsyncMaterialSelectProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  instanceId?: string
}

export function AsyncMaterialSelect({
  value,
  onChange,
  placeholder = 'Buscar material...',
  className,
  instanceId
}: AsyncMaterialSelectProps) {
  const [initialOption, setInitialOption] = useState<Option | null>(null)

  // Fetch initial option if value is present
  useEffect(() => {
    if (value && !initialOption) {
      metricsApi.getTopMaterials(1, { material_id: Number(value) }).then(res => {
        if (res.data && res.data.length > 0) {
          setInitialOption({ label: res.data[0].title, value: String(res.data[0].id) })
        }
      })
    } else if (!value) {
      setInitialOption(null)
    }
  }, [value])

  const loadOptions = async (inputValue: string) => {
    try {
      const response = await metricsApi.getTopMaterials(20, { q: inputValue })
      const options = [
        { label: 'Todos los materiales', value: '' },
        ...response.data.map(m => ({ label: m.title, value: String(m.id) }))
      ]
      return options
    } catch (error) {
      console.error('Error fetching materials', error)
      return [{ label: 'Todos los materiales', value: '' }]
    }
  }

  const customStyles = {
    control: (base: any, state: any) => ({
      ...base,
      backgroundColor: 'transparent',
      borderColor: state.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--border) / 0.5)',
      borderRadius: 'calc(var(--radius) + 2px)',
      minHeight: '40px',
      boxShadow: state.isFocused ? '0 0 0 1px hsl(var(--ring))' : 'none',
      '&:hover': {
        borderColor: state.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--border))'
      }
    }),
    valueContainer: (base: any) => ({
      ...base,
      padding: '0 12px',
      color: 'hsl(var(--foreground))'
    }),
    singleValue: (base: any) => ({
      ...base,
      color: 'hsl(var(--foreground))'
    }),
    input: (base: any) => ({
      ...base,
      color: 'hsl(var(--foreground))'
    }),
    menu: (base: any) => ({
      ...base,
      backgroundColor: 'hsl(var(--popover))',
      border: '1px solid hsl(var(--border))',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      borderRadius: 'calc(var(--radius) + 2px)',
      overflow: 'hidden',
      zIndex: 50
    }),
    option: (base: any, state: any) => ({
      ...base,
      backgroundColor: state.isSelected
        ? 'hsl(var(--primary))'
        : state.isFocused
        ? 'hsl(var(--accent))'
        : 'transparent',
      color: state.isSelected
        ? 'hsl(var(--primary-foreground))'
        : state.isFocused
        ? 'hsl(var(--accent-foreground))'
        : 'hsl(var(--popover-foreground))',
      cursor: 'pointer',
      padding: '8px 12px',
      '&:active': {
        backgroundColor: state.isSelected ? 'hsl(var(--primary))' : 'hsl(var(--accent))'
      }
    }),
    indicatorSeparator: () => ({ display: 'none' }),
    dropdownIndicator: (base: any) => ({
      ...base,
      color: 'hsl(var(--muted-foreground))',
      '&:hover': { color: 'hsl(var(--foreground))' }
    })
  }

  const selectedValue = value ? (initialOption?.value === value ? initialOption : null) : { label: 'Todos los materiales', value: '' }

  return (
    <AsyncSelect
      instanceId={instanceId || 'async-material-select'}
      cacheOptions
      defaultOptions
      loadOptions={loadOptions}
      value={selectedValue}
      onChange={(option: any) => {
        setInitialOption(option)
        onChange(option?.value || '')
      }}
      placeholder={placeholder}
      className={className}
      styles={customStyles}
      noOptionsMessage={() => 'No se encontraron materiales'}
      loadingMessage={() => 'Buscando...'}
    />
  )
}
