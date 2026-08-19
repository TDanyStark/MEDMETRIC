import AsyncSelect from 'react-select/async'
import type { FormatOptionLabelMeta, StylesConfig } from 'react-select'

import { listOrgUsers } from '@/services/backoffice'
import { ManagerOption } from '@/types/backoffice'

interface SelectOption {
  label: string
  value: number
  email?: string
}

interface ManagerMultiSelectProps {
  value: ManagerOption[]
  onChange: (managers: ManagerOption[]) => void
  placeholder?: string
  instanceId?: string
  isDisabled?: boolean
}

function toOption(manager: ManagerOption & { email?: string }): SelectOption {
  return { label: manager.name, value: manager.id, email: manager.email }
}

export function ManagerMultiSelect({
  value,
  onChange,
  placeholder = 'Buscar gerentes...',
  instanceId = 'manager-multi-select',
  isDisabled,
}: ManagerMultiSelectProps) {
  const loadOptions = async (inputValue: string): Promise<SelectOption[]> => {
    try {
      const response = await listOrgUsers({ role: 'manager', q: inputValue, page: 1 })
      return response.items.map(manager => ({
        label: manager.name,
        value: manager.id,
        email: manager.email,
      }))
    } catch (error) {
      console.error('Error fetching managers', error)
      return []
    }
  }

  const selectedOptions: SelectOption[] = value.map(toOption)

  const customStyles: StylesConfig<SelectOption, true> = {
    control: (base, state) => ({
      ...base,
      backgroundColor: 'var(--background)',
      borderColor: state.isFocused ? 'var(--primary)' : 'var(--border)',
      borderRadius: '16px',
      padding: '2px 6px',
      minHeight: '44px',
      boxShadow: state.isFocused ? '0 0 0 2px var(--ring)' : 'none',
      '&:hover': { borderColor: 'var(--primary)' },
      transition: 'all 0.2s ease',
    }),
    valueContainer: (base) => ({
      ...base,
      padding: '4px 6px',
      gap: '6px',
    }),
    placeholder: (base) => ({
      ...base,
      color: 'var(--muted-foreground)',
      fontSize: '0.875rem',
    }),
    input: (base) => ({ ...base, color: 'var(--foreground)' }),
    multiValue: (base) => ({
      ...base,
      backgroundColor: 'var(--primary)',
      borderRadius: '9999px',
      padding: '1px 2px 1px 4px',
      margin: 0,
    }),
    multiValueLabel: (base) => ({
      ...base,
      color: 'var(--primary-foreground)',
      fontSize: '0.78rem',
      fontWeight: '600',
      padding: '2px 4px',
    }),
    multiValueRemove: (base) => ({
      ...base,
      color: 'var(--primary-foreground)',
      borderRadius: '9999px',
      opacity: 0.8,
      '&:hover': {
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        color: 'var(--primary-foreground)',
        opacity: 1,
      },
    }),
    menu: (base) => ({
      ...base,
      backgroundColor: 'var(--popover)',
      borderRadius: '16px',
      marginTop: '4px',
      marginBottom: '4px',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      border: '1px solid var(--border)',
      overflow: 'hidden',
      zIndex: 50,
    }),
    menuPortal: (base) => ({ ...base, zIndex: 60, pointerEvents: 'auto' }),
    menuList: (base) => ({
      ...base,
      padding: '4px',
      maxHeight: '220px',
      overflowY: 'auto',
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused ? 'var(--accent)' : 'transparent',
      color: 'var(--foreground)',
      borderRadius: '12px',
      margin: '2px 0',
      cursor: 'pointer',
      fontSize: '0.875rem',
      fontWeight: '500',
      '&:active': { backgroundColor: 'var(--accent)' },
    }),
    indicatorSeparator: () => ({ display: 'none' }),
    dropdownIndicator: (base, state) => ({
      ...base,
      color: state.isFocused ? 'var(--primary)' : 'var(--muted-foreground)',
      '&:hover': { color: 'var(--primary)' },
    }),
  }

  return (
    <AsyncSelect<SelectOption, true>
      isMulti
      instanceId={instanceId}
      classNamePrefix="manager-select"
      cacheOptions
      defaultOptions
      isDisabled={isDisabled}
      loadOptions={loadOptions}
      value={selectedOptions}
      onChange={(options) => {
        const next = options ?? []
        onChange(next.map(option => ({ id: option.value, name: option.label })))
      }}
      placeholder={placeholder}
      styles={customStyles}
      menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
      menuPosition="fixed"
      menuPlacement="auto"
      menuShouldScrollIntoView={false}
      maxMenuHeight={220}
      formatOptionLabel={(option: SelectOption, meta: FormatOptionLabelMeta<SelectOption>) =>
        meta.context === 'menu' ? (
          <div className="flex flex-col">
            <span className="font-medium">{option.label}</span>
            {option.email && <span className="text-xs text-muted-foreground">{option.email}</span>}
          </div>
        ) : (
          option.label
        )
      }
      noOptionsMessage={() => 'No se encontraron gerentes'}
      loadingMessage={() => 'Buscando...'}
    />
  )
}
