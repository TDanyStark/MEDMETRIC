import { useEffect, useState } from 'react'
import AsyncSelect from 'react-select/async'
import { toast } from 'sonner'
import { searchReps } from '@/services/doctors'
import { createAsyncSelectStyles } from './asyncSelectStyles'
import { cn } from '@/lib/utils'

interface Option {
  label: string
  value: string
}

interface RepAssignSelectProps {
  value: number | null
  onChange: (repId: number | null) => void
  /**
   * Label for `value` already known by the caller (e.g. Doctor.assigned_rep_name
   * from the record being edited). Lets the Edit dialog preload the current
   * representative instantly, without an extra round-trip to
   * /doctors/reps/search — which also sidesteps the edge case where a
   * manager's subscribed-reps search wouldn't include a rep assigned earlier
   * by org_admin (or by a different manager).
   */
  initialLabel?: string | null
  label?: string
  placeholder?: string
  className?: string
  containerClassName?: string
  instanceId?: string
  isDisabled?: boolean
}

/**
 * Async single-select "Asignar representante" control for the doctor
 * Create/Edit forms. Shares the role-scoped GET /v1/doctors/reps/search
 * endpoint and visual language with RepFilterSelect, but — unlike that
 * list-filter control — has no "todos los representantes" pseudo-option:
 * this select assigns ONE doctor to (at most) one rep, so an empty/cleared
 * selection means "sin asignar" (assigned_rep_id = null), not "show all".
 */
export function RepAssignSelect({
  value,
  onChange,
  initialLabel,
  label,
  placeholder = 'Buscar representante...',
  className,
  containerClassName,
  instanceId,
  isDisabled,
}: RepAssignSelectProps) {
  const [selectedOption, setSelectedOption] = useState<Option | null>(
    value ? { label: initialLabel || `#${value}`, value: String(value) } : null,
  )

  // Re-sync when the bound value changes from outside the select itself —
  // e.g. the Edit dialog re-opens on a different doctor, or the create form
  // resets after a successful submit.
  useEffect(() => {
    if (!value) {
      setSelectedOption(null)
      return
    }
    if (selectedOption?.value !== String(value)) {
      setSelectedOption({ label: initialLabel || `#${value}`, value: String(value) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, initialLabel])

  const loadOptions = async (inputValue: string): Promise<Option[]> => {
    try {
      const reps = await searchReps(inputValue)
      return reps.map(rep => ({ label: rep.name, value: String(rep.id) }))
    } catch (error) {
      console.error('Error fetching reps', error)
      toast.error('No se pudieron cargar los representantes.')
      return []
    }
  }

  return (
    <div className={cn('flex flex-col gap-2', containerClassName)}>
      {label && (
        <label className="text-[0.72rem] font-bold uppercase tracking-[0.18em] text-muted-foreground/80 pl-1">
          {label}
        </label>
      )}
      <AsyncSelect
        instanceId={instanceId || 'rep-assign-select'}
        cacheOptions
        defaultOptions
        loadOptions={loadOptions}
        value={selectedOption}
        onChange={(option: any) => {
          setSelectedOption(option)
          onChange(option?.value ? Number(option.value) : null)
        }}
        isClearable
        isDisabled={isDisabled}
        placeholder={placeholder}
        className={className}
        styles={createAsyncSelectStyles()}
        // Kept as a normal DOM descendant of the Dialog's content — same
        // model as the (working) Región/Provincia/Comuna CustomSelects and
        // RepFilterSelect. An earlier version portalled this menu to
        // <body> with menuPosition="fixed" so it could visually escape the
        // Dialog's overflow-y-auto clipping near the bottom of the form.
        // That broke containment (the menu rendered detached from its
        // trigger, floating over unrelated fields) and, since the portal
        // sits outside Radix Dialog's `react-remove-scroll` shard, silently
        // blocked native wheel/touch scrolling over the option list —
        // patched at the time with a hand-rolled scroll handler
        // (ScrollLockSafeMenuList) instead of fixing the actual placement.
        // Letting react-select pick the placement itself — "auto" measures
        // the real available space and opens upward here since this is the
        // last field before the dialog's footer — keeps the menu inside the
        // Dialog subtree (native scroll works, focus trap is unaffected)
        // without ever growing the modal or clipping the option list.
        menuPlacement="auto"
        noOptionsMessage={() => 'No se encontraron representantes'}
        loadingMessage={() => 'Buscando...'}
      />
    </div>
  )
}
