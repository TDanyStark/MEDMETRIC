/**
 * Shared react-select/async style tokens for single-select AJAX controls
 * (RepFilterSelect, RepAssignSelect). Mirrors CustomSelect's synchronous
 * styling (same border radius, control tokens, popover elevation) so async
 * and sync selects are visually indistinguishable across the app — a single
 * source of truth instead of re-declaring the same style object per select.
 *
 * `hasError` swaps the control border/ring to the destructive token, same
 * convention as CustomSelect's `error` prop.
 */
export function createAsyncSelectStyles(hasError = false) {
  return {
    control: (base: any, state: any) => ({
      ...base,
      backgroundColor: 'var(--background)',
      borderColor: hasError
        ? 'var(--destructive)'
        : state.isFocused
          ? 'var(--primary)'
          : 'var(--border)',
      borderRadius: '16px',
      padding: '2px 8px',
      minHeight: '44px',
      boxShadow: state.isFocused
        ? `0 0 0 2px ${hasError ? 'var(--destructive)' : 'var(--ring)'}`
        : 'none',
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
      color: state.isSelected ? 'var(--primary-foreground)' : 'var(--foreground)',
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
    // Only takes effect when a consumer also passes `menuPortalTarget`
    // (react-select renders the menu inside this wrapper via a portal in
    // that case). Keeps the portalled menu above Radix Dialog's overlay/
    // content (z-50) regardless of DOM insertion order. No-op otherwise.
    //
    // `pointerEvents: 'auto'` is required, not cosmetic: Radix Dialog
    // (modal) sets `document.body.style.pointerEvents = 'none'` while open
    // and restores `pointer-events: auto` only on the DialogContent DOM
    // node itself (inherited by its descendants). This portal wrapper is
    // mounted directly under <body> as a SIBLING of DialogContent — not a
    // descendant — so without this override it silently inherits
    // `pointer-events: none` from body and every click on an option falls
    // through the (invisible-to-hit-testing) menu to whatever dialog
    // control sits underneath it instead of registering on the option.
    // Mirrors the same fix already applied in multiSelectStyles.ts /
    // ManagerMultiSelect's inline styles for the same portal-in-modal case.
    menuPortal: (base: any) => ({ ...base, zIndex: 9999, pointerEvents: 'auto' }),
  }
}
