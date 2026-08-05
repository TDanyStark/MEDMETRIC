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
        // This field sits near the bottom of the Create/Edit Doctor dialogs
        // (DialogContent has max-h-[90vh] overflow-y-auto). A downward menu
        // there gets appended past the dialog's visible bounds, forcing the
        // whole modal to grow/scroll just to show the dropdown — poor UX.
        // Force the menu upward and portal it to <body> with fixed
        // positioning so it's laid out purely against the viewport: it
        // never contributes to the dialog's scrollHeight (no more modal
        // "stretching"), never gets clipped by the dialog's overflow-auto,
        // and still tracks the trigger correctly on scroll/resize —
        // react-select's own documented pattern for selects inside modals.
        // Keyboard nav, focus and click-outside handling are unaffected;
        // only the rendered DOM location and stacking of the menu changes.
        menuPlacement="top"
        menuPosition="fixed"
        menuPortalTarget={document.body}
        noOptionsMessage={() => 'No se encontraron representantes'}
        loadingMessage={() => 'Buscando...'}
      />
    </div>
  )
}
