import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { RepFilterSelect } from '@/components/ui/RepFilterSelect'
import { SearchToolbar } from '@/components/backoffice/Workbench'
import { useAuth } from '@/contexts/useAuth'

interface DoctorFiltersProps {
  q: string
  repId: number | null
  onSearchChange: (value: string) => void
  onRepIdChange: (repId: number | null) => void
  onClear: () => void
}

export function DoctorFilters({ q, repId, onSearchChange, onRepIdChange, onClear }: DoctorFiltersProps) {
  const { user } = useAuth()
  // Reps are already hard-scoped to their own doctors server-side — showing
  // a representative filter to them would be meaningless (and there is no
  // GET /v1/doctors/reps/search access for their role either).
  const showRepFilter = user?.role !== 'rep'
  const isAnyFilterActive = Boolean(q || repId)

  return (
    <SearchToolbar
      value={q}
      onChange={onSearchChange}
      placeholder="Buscar médico por nombre, documento o institución..."
      extra={
        <div className="flex flex-wrap items-center gap-2 lg:gap-3">
          {isAnyFilterActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="h-11 px-3 text-muted-foreground hover:text-destructive"
            >
              <X className="mr-2 h-4 w-4" />
              Limpiar
            </Button>
          )}

          {showRepFilter && (
            <RepFilterSelect
              className="w-full sm:w-64"
              value={repId}
              onChange={onRepIdChange}
              instanceId="doctor-filters-rep-select"
            />
          )}
        </div>
      }
    />
  )
}
