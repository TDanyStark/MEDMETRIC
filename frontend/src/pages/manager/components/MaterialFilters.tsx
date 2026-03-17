import { SearchToolbar, SegmentedControl } from '@/components/backoffice/Workbench'

interface MaterialFiltersProps {
  q: string
  status: string
  type: string
  onSearchChange: (value: string) => void
  onStatusChange: (value: string) => void
  onTypeChange: (value: string) => void
}

export function MaterialFilters({
  q,
  status,
  type,
  onSearchChange,
  onStatusChange,
  onTypeChange,
}: MaterialFiltersProps) {
  return (
    <SearchToolbar
      value={q}
      onChange={onSearchChange}
      placeholder="Buscar materiales..."
      extra={
        <div className="flex gap-2">
          <SegmentedControl
            value={status}
            onChange={onStatusChange}
            options={[
              { label: 'Todos', value: 'all' },
              { label: 'Borrador', value: 'draft' },
              { label: 'Aprobado', value: 'approved' },
            ]}
          />
          <SegmentedControl
            value={type}
            onChange={onTypeChange}
            options={[
              { label: 'Todos', value: 'all' },
              { label: 'PDF', value: 'pdf' },
              { label: 'Video', value: 'video' },
            ]}
          />
        </div>
      }
    />
  )
}
