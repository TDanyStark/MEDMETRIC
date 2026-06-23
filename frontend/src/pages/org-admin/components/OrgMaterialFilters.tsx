import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { SearchToolbar } from '@/components/backoffice/Workbench'
import { Brand, ManagerOption } from '@/types/backoffice'

interface OrgMaterialFiltersProps {
  q: string
  status: string
  type: string
  brandId: string
  managerId: string
  brands: Brand[]
  managers: ManagerOption[]
  onSearchChange: (value: string) => void
  onStatusChange: (value: string) => void
  onTypeChange: (value: string) => void
  onBrandChange: (value: string) => void
  onManagerChange: (value: string) => void
  onClear: () => void
}

export function OrgMaterialFilters({
  q,
  status,
  type,
  brandId,
  managerId,
  brands,
  managers,
  onSearchChange,
  onStatusChange,
  onTypeChange,
  onBrandChange,
  onManagerChange,
  onClear,
}: OrgMaterialFiltersProps) {
  const isAnyFilterActive =
    q || status !== 'all' || type !== 'all' || brandId !== 'all' || managerId !== 'all'

  const brandOptions = [
    { label: 'Todas las marcas', value: 'all' },
    ...brands.map((b) => ({ label: b.name, value: String(b.id) })),
  ]

  const managerOptions = [
    { label: 'Todos los gerentes', value: 'all' },
    ...managers.map((m) => ({ label: m.name, value: String(m.id) })),
  ]

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
            instanceId="brand-filter"
            value={brandOptions.find((o) => o.value === brandId) ?? brandOptions[0]}
            onChange={(option) => onBrandChange((option as { value: string }).value)}
            options={brandOptions}
            className="w-full min-w-40 sm:w-auto"
          />

          <CustomSelect
            instanceId="manager-filter"
            value={managerOptions.find((o) => o.value === managerId) ?? managerOptions[0]}
            onChange={(option) => onManagerChange((option as { value: string }).value)}
            options={managerOptions}
            className="w-full min-w-40 sm:w-auto"
          />

          <CustomSelect
            instanceId="status-filter"
            value={{
              label: status === 'all' ? 'Estados' : status === 'draft' ? 'Borrador' : 'Aprobado',
              value: status,
            }}
            onChange={(option) => onStatusChange((option as { value: string }).value)}
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
            onChange={(option) => onTypeChange((option as { value: string }).value)}
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
