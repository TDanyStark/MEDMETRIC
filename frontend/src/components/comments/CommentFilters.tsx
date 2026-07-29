import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { SearchToolbar } from '@/components/backoffice/Workbench'

type HasMaterialOption = { label: string; value: string }

const HAS_MATERIAL_OPTIONS: HasMaterialOption[] = [
  { label: 'Con material', value: 'true' },
  { label: 'Abierto (sin material)', value: 'false' },
]

interface CommentFiltersProps {
  q: string
  hasMaterial: string
  dateFrom: string
  dateTo: string
  onSearchChange: (value: string) => void
  onHasMaterialChange: (value: string) => void
  onDateFromChange: (value: string) => void
  onDateToChange: (value: string) => void
  onClear: () => void
}

export function CommentFilters({
  q,
  hasMaterial,
  dateFrom,
  dateTo,
  onSearchChange,
  onHasMaterialChange,
  onDateFromChange,
  onDateToChange,
  onClear,
}: CommentFiltersProps) {
  const isAnyFilterActive = Boolean(q || hasMaterial || dateFrom || dateTo)

  return (
    <SearchToolbar
      value={q}
      onChange={onSearchChange}
      placeholder="Buscar por comentario, médico o representante..."
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

          <CustomSelect<HasMaterialOption>
            containerClassName="w-full sm:w-56"
            placeholder="Material"
            value={hasMaterial ? HAS_MATERIAL_OPTIONS.find(option => option.value === hasMaterial) ?? null : null}
            onChange={option => onHasMaterialChange(option?.value ?? '')}
            options={HAS_MATERIAL_OPTIONS}
            isClearable
          />

          <Input
            type="date"
            value={dateFrom}
            onChange={event => onDateFromChange(event.target.value)}
            className="h-11 w-full sm:w-40"
            aria-label="Desde"
          />

          <Input
            type="date"
            value={dateTo}
            onChange={event => onDateToChange(event.target.value)}
            className="h-11 w-full sm:w-40"
            aria-label="Hasta"
          />
        </div>
      }
    />
  )
}
