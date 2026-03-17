import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { SearchToolbar } from '@/components/backoffice/Workbench'

interface MaterialFiltersProps {
  q: string
  status: string
  type: string
  onSearchChange: (value: string) => void
  onStatusChange: (value: string) => void
  onTypeChange: (value: string) => void
  onClear: () => void
}

export function MaterialFilters({
  q,
  status,
  type,
  onSearchChange,
  onStatusChange,
  onTypeChange,
  onClear,
}: MaterialFiltersProps) {
  const isAnyFilterActive = q || status !== 'all' || type !== 'all'

  return (
    <SearchToolbar
      value={q}
      onChange={onSearchChange}
      placeholder="Buscar materiales..."
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

          <Select
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="h-11 w-full min-w-32 sm:w-auto"
          >
            <option value="all">Estados</option>
            <option value="draft">Borrador</option>
            <option value="approved">Aprobado</option>
          </Select>

          <Select
            value={type}
            onChange={(e) => onTypeChange(e.target.value)}
            className="h-11 w-full min-w-32 sm:w-auto"
          >
            <option value="all">Tipos</option>
            <option value="pdf">PDF</option>
            <option value="video">Video</option>
            <option value="link">Link</option>
          </Select>
        </div>
      }
    />
  )
}

