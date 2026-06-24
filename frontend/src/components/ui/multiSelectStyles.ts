/**
 * Shared react-select styles for multi-select comboboxes used across the
 * metrics filters. Kept in one place so material and rep pickers stay visually
 * consistent and theme-aware (light/dark via CSS vars).
 */
export const multiSelectStyles = {
  control: (base: any, state: any) => ({
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
  valueContainer: (base: any) => ({
    ...base,
    padding: '4px 6px',
    gap: '6px',
  }),
  placeholder: (base: any) => ({
    ...base,
    color: 'var(--muted-foreground)',
    fontSize: '0.875rem',
  }),
  input: (base: any) => ({ ...base, color: 'var(--foreground)' }),
  multiValue: (base: any) => ({
    ...base,
    backgroundColor: 'var(--primary)',
    borderRadius: '9999px',
    padding: '1px 2px 1px 4px',
    margin: 0,
  }),
  multiValueLabel: (base: any) => ({
    ...base,
    color: 'var(--primary-foreground)',
    fontSize: '0.78rem',
    fontWeight: '600',
    padding: '2px 4px',
  }),
  multiValueRemove: (base: any) => ({
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
  menu: (base: any) => ({
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
  menuPortal: (base: any) => ({ ...base, zIndex: 60, pointerEvents: 'auto' }),
  menuList: (base: any) => ({
    ...base,
    padding: '4px',
    maxHeight: '240px',
    overflowY: 'auto',
  }),
  option: (base: any, state: any) => ({
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
  dropdownIndicator: (base: any, state: any) => ({
    ...base,
    color: state.isFocused ? 'var(--primary)' : 'var(--muted-foreground)',
    '&:hover': { color: 'var(--primary)' },
  }),
}
