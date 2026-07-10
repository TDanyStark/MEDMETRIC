import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { SearchToolbar } from '@/components/backoffice/Workbench'
import { CHILE_REGIONS } from '@/data/chileGeo'

type RegionOption = { label: string; value: string }

const REGION_OPTIONS: RegionOption[] = CHILE_REGIONS.map(region => ({ label: region.name, value: region.name }))

interface DoctorFiltersProps {
  q: string
  region: string
  category: string
  onSearchChange: (value: string) => void
  onRegionChange: (value: string) => void
  onCategoryChange: (value: string) => void
  onClear: () => void
}

export function DoctorFilters({
  q,
  region,
  category,
  onSearchChange,
  onRegionChange,
  onCategoryChange,
  onClear,
}: DoctorFiltersProps) {
  const isAnyFilterActive = Boolean(q || region || category)

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

          <CustomSelect<RegionOption>
            containerClassName="w-full sm:w-48"
            placeholder="Región"
            value={region ? { label: region, value: region } : null}
            onChange={option => onRegionChange(option?.value ?? '')}
            options={REGION_OPTIONS}
            isSearchable
            isClearable
          />

          <Input
            value={category}
            onChange={event => onCategoryChange(event.target.value)}
            placeholder="Categoría"
            className="h-11 w-full sm:w-40"
          />
        </div>
      }
    />
  )
}
