import { cn } from '@/lib/utils'

interface CompactSwitchProps {
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
  label?: string
  size?: 'sm' | 'md'
}

export function CompactSwitch({ checked, onChange, disabled, label, size = 'md' }: CompactSwitchProps) {
  const trackSize = size === 'sm' ? 'h-5 w-9' : 'h-6 w-11'
  const knobSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'
  const knobTranslate = size === 'sm' ? (checked ? 'translate-x-4' : 'translate-x-0.5') : checked ? 'translate-x-5' : 'translate-x-0.5'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out disabled:cursor-not-allowed disabled:opacity-50',
        trackSize,
        checked ? 'bg-emerald-500' : 'bg-gray-300',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block transform rounded-full bg-white shadow-md ring-1 ring-black/5 transition-transform duration-200 ease-in-out',
          knobSize,
          knobTranslate,
        )}
      />
    </button>
  )
}
