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
      backgroundColor: 'var(--background)',
      borderColor: state.isFocused ? 'var(--primary)' : 'var(--border)',
      borderRadius: '16px',
      padding: '2px 8px',
      minHeight: '44px',
      boxShadow: state.isFocused ? '0 0 0 2px var(--ring)' : 'none',
      '&:hover': {
        borderColor: state.isFocused ? 'var(--primary)' : 'var(--primary)',
      },
      transition: 'all 0.2s ease',
    }),
    valueContainer: (base: any) => ({
      ...base,
      paddingLeft: '4px',
    }),
    singleValue: (base: any) => ({
      ...base,
      color: 'var(--foreground)',
      fontWeight: '500',
    }),
    placeholder: (base: any) => ({
      ...base,
      color: 'var(--muted-foreground)',
      fontSize: '0.875rem',
    }),
    input: (base: any) => ({
      ...base,
      color: 'var(--foreground)'
    }),
    menu: (base: any) => ({
      ...base,
      backgroundColor: 'var(--popover)',
      borderRadius: '16px',
      marginTop: '8px',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      border: '1px solid var(--border)',
      overflow: 'hidden',
      zIndex: 50,
      animation: 'in 0.2s ease-out',
    }),
    menuList: (base: any) => ({
      ...base,
      padding: '4px',
    }),
    option: (base: any, state: any) => ({
      ...base,
      backgroundColor: state.isSelected 
        ? 'var(--primary)' 
        : state.isFocused 
          ? 'var(--accent)' 
          : 'transparent',
      color: state.isSelected 
        ? 'var(--primary-foreground)' 
        : 'var(--foreground)',
      borderRadius: '12px',
      margin: '2px 0',
      cursor: 'pointer',
      fontSize: '0.875rem',
      fontWeight: '500',
      '&:active': {
        backgroundColor: 'var(--primary)',
        color: 'var(--primary-foreground)',
      },
    }),
    indicatorSeparator: () => ({ display: 'none' }),
    dropdownIndicator: (base: any, state: any) => ({
      ...base,
      color: state.isFocused ? 'var(--primary)' : 'var(--muted-foreground)',
      '&:hover': { color: 'var(--primary)' }
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
