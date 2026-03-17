import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { CustomSelect } from '@/components/ui/CustomSelect'
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

          <CustomSelect
            instanceId="status-filter"
            value={{ label: status === 'all' ? 'Estados' : status === 'draft' ? 'Borrador' : 'Aprobado', value: status }}
            onChange={(option) => onStatusChange((option as any).value)}
            options={[
              { label: 'Estados', value: 'all' },
              { label: 'Borrador', value: 'draft' },
              { label: 'Aprobado', value: 'approved' },
            ]}
            className="w-full min-w-32 sm:w-auto"
            isSearchable={false}
          />

          <CustomSelect
            instanceId="type-filter"
            value={{ label: type === 'all' ? 'Tipos' : type.toUpperCase(), value: type }}
            onChange={(option) => onTypeChange((option as any).value)}
            options={[
              { label: 'Tipos', value: 'all' },
              { label: 'PDF', value: 'pdf' },
              { label: 'Video', value: 'video' },
              { label: 'Link', value: 'link' },
            ]}
            className="w-full min-w-32 sm:w-auto"
            isSearchable={false}
          />
        </div>
      }
    />
  )
}

