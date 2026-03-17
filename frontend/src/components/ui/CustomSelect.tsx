import Select, { Props as SelectProps, GroupBase, StylesConfig } from 'react-select'
import { useId } from 'react'

interface CustomSelectProps<
  Option = { label: string; value: string | number },
  IsMulti extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>
> extends SelectProps<Option, IsMulti, Group> {
  label?: string
  error?: string
  containerClassName?: string
}

export function CustomSelect<
  Option = { label: string; value: string | number },
  IsMulti extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>
>({ 
  label, 
  error, 
  containerClassName,
  ...props 
}: CustomSelectProps<Option, IsMulti, Group>) {
  const instanceId = useId()

  const customStyles: StylesConfig<Option, IsMulti, Group> = {
    control: (base, state) => ({
      ...base,
      backgroundColor: 'var(--background)',
      borderColor: error ? 'var(--destructive)' : state.isFocused ? 'var(--primary)' : 'var(--border)',
      borderRadius: '16px', // Rounded like the input
      padding: '2px 8px',
      minHeight: '44px',
      boxShadow: state.isFocused ? '0 0 0 2px var(--ring)' : 'none',
      '&:hover': {
        borderColor: state.isFocused ? 'var(--primary)' : 'var(--primary / 0.5)',
      },
      transition: 'all 0.2s ease',
    }),
    valueContainer: (base) => ({
      ...base,
      paddingLeft: '4px',
    }),
    singleValue: (base) => ({
      ...base,
      color: 'var(--foreground)',
      fontWeight: '500',
    }),
    placeholder: (base) => ({
      ...base,
      color: 'var(--muted-foreground)',
      fontSize: '0.875rem',
    }),
    menu: (base) => ({
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
    menuList: (base) => ({
      ...base,
      padding: '4px',
    }),
    option: (base, state) => ({
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
    indicatorSeparator: () => ({
      display: 'none',
    }),
    dropdownIndicator: (base, state) => ({
      ...base,
      color: state.isFocused ? 'var(--primary)' : 'var(--muted-foreground)',
      '&:hover': {
        color: 'var(--primary)',
      },
    }),
  }

  return (
    <div className={`flex flex-col gap-2 ${containerClassName ?? ''}`}>
      {label && (
        <label className="text-[0.72rem] font-bold uppercase tracking-[0.18em] text-muted-foreground/80 pl-1">
          {label}
        </label>
      )}
      <Select
        instanceId={instanceId}
        styles={customStyles}
        {...props}
      />
      {error && <p className="text-xs font-medium text-destructive pl-1">{error}</p>}
    </div>
  )
}
