import type { GroupBase, StylesConfig } from 'react-select'

/**
 * Shared react-select styles for multi-select comboboxes used across the
 * metrics filters. Kept in one place so material and rep pickers stay visually
 * consistent and theme-aware (light/dark via CSS vars).
 *
 * Generic factory (rather than a plain object) so each consumer can bind it
 * to its own `Option` shape via `createMultiSelectStyles<Option>()` — the
 * style callbacks below never touch `Option`-specific fields, so the shape
 * is safe to share across all multi-select wrappers.
 */
export function createMultiSelectStyles<
  Option,
  IsMulti extends boolean = true,
  Group extends GroupBase<Option> = GroupBase<Option>,
>(): StylesConfig<Option, IsMulti, Group> {
  return {
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
      boxShadow:
        '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      border: '1px solid var(--border)',
      overflow: 'hidden',
      zIndex: 50,
    }),
    menuPortal: (base) => ({ ...base, zIndex: 60, pointerEvents: 'auto' }),
    menuList: (base) => ({
      ...base,
      padding: '4px',
      maxHeight: '240px',
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
}
