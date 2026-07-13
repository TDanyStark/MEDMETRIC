import { useEffect, useState } from 'react'
import AsyncSelect from 'react-select/async'
import { useDebouncedCallback } from 'use-debounce'
import { searchDoctors } from '@/services/doctors'
import { Doctor } from '@/types/doctor'

const SEARCH_DEBOUNCE_MS = 350

interface Option {
  label: string
  value: number
  doctor: Doctor
}

interface DoctorSelectProps {
  value: number | null
  onChange: (doctorId: number | null, doctor: Doctor | null) => void
  placeholder?: string
  className?: string
  instanceId?: string
  onInputChange?: (value: string) => void
}

function toOption(doctor: Doctor): Option {
  const institution = doctor.institution ?? 'Sin institución'
  const comuna = doctor.comuna ?? 'Sin comuna'
  return { label: `${doctor.name} — ${institution} (${comuna})`, value: doctor.id, doctor }
}

export function DoctorSelect({
  value,
  onChange,
  placeholder = 'Buscar médico...',
  className,
  instanceId,
  onInputChange,
}: DoctorSelectProps) {
  const [selectedOption, setSelectedOption] = useState<Option | null>(null)

  useEffect(() => {
    if (!value) {
      setSelectedOption(null)
      return
    }

    if (selectedOption?.value === value) {
      return
    }

    searchDoctors('').then(results => {
      const match = results.find(doctor => doctor.id === value)
      if (match) {
        setSelectedOption(toOption(match))
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  // Debounced so we only hit the API after the user stops typing, instead of
  // firing a request on every keystroke. Uses the callback-based loadOptions
  // signature (rather than returning a Promise) so react-select resolves the
  // menu once the debounced call actually runs.
  const loadOptions = useDebouncedCallback(
    (inputValue: string, callback: (options: Option[]) => void) => {
      searchDoctors(inputValue)
        .then(results => callback(results.map(toOption)))
        .catch(error => {
          console.error('Error fetching doctors', error)
          callback([])
        })
    },
    SEARCH_DEBOUNCE_MS
  )

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
      color: 'var(--foreground)',
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
      maxHeight: '260px',
      overflowY: 'auto',
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
      '&:hover': { color: 'var(--primary)' },
    }),
  }

  return (
    <AsyncSelect
      instanceId={instanceId || 'doctor-select'}
      classNamePrefix="doctor-select"
      cacheOptions
      defaultOptions
      loadOptions={loadOptions}
      value={selectedOption}
      onChange={(option: any) => {
        setSelectedOption(option ?? null)
        onChange(option?.value ?? null, option?.doctor ?? null)
      }}
      placeholder={placeholder}
      className={className}
      styles={customStyles}
      onInputChange={(input, meta) => {
        if (meta.action === 'input-change') {
          onInputChange?.(input)
        }
      }}
      menuPlacement="auto"
      menuShouldScrollIntoView={false}
      maxMenuHeight={260}
      noOptionsMessage={() => 'No se encontraron médicos'}
      loadingMessage={() => 'Buscando...'}
    />
  )
}
