import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SearchToolbar } from "@/components/backoffice/Workbench";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { MaterialFilters as MaterialFiltersType } from "@/services/rep";

interface MaterialFiltersProps {
  query: string;
  type: string;
  managerId: number | null;
  brandId: number | null;
  filtersOptions: MaterialFiltersType | undefined;
  isLoadingFilters: boolean;
  onQueryChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  onManagerChange: (value: number | null) => void;
  onBrandChange: (value: number | null) => void;
  onClear: () => void;
}

export function MaterialFilters({
  query,
  type,
  managerId,
  brandId,
  filtersOptions,
  isLoadingFilters,
  onQueryChange,
  onTypeChange,
  onManagerChange,
  onBrandChange,
  onClear,
}: MaterialFiltersProps) {
  const isAnyFilterActive = query || type !== "all" || managerId || brandId;

  return (
    <SearchToolbar
      value={query}
      onChange={onQueryChange}
      placeholder="Buscar material..."
      extra={
        <div className="flex flex-wrap items-center gap-2 lg:gap-3">
          {isAnyFilterActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="h-11 px-3 text-muted-foreground hover:text-destructive"
            >
              <X className="h-4 w-4 mr-2" />
              Limpiar
            </Button>
          )}

          <CustomSelect
            instanceId="type-filter"
            value={{ label: type === 'all' ? 'Tipos' : type.toUpperCase(), value: type }}
            onChange={(option: any) => onTypeChange(option.value)}
            options={[
              { label: 'Tipos', value: 'all' },
              { label: 'PDF', value: 'pdf' },
              { label: 'Video', value: 'video' },
              { label: 'Link', value: 'link' },
            ]}
            className="w-full min-w-32 sm:w-auto"
            isSearchable={false}
          />

          <CustomSelect
            instanceId="manager-filter"
            value={filtersOptions?.managers.find(m => m.manager_id === managerId) ? { label: filtersOptions?.managers.find(m => m.manager_id === managerId)?.manager_name ?? 'Gerentes', value: managerId } : { label: 'Gerentes', value: '' }}
            onChange={(option: any) => onManagerChange(option.value ? Number(option.value) : null)}
            options={[
              { label: 'Gerentes', value: '' },
              ...(filtersOptions?.managers.map((m) => ({ label: m.manager_name, value: m.manager_id })) || [])
            ]}
            className="w-full min-w-44 sm:w-auto"
            isLoading={isLoadingFilters}
          />

          <CustomSelect
            instanceId="brand-filter"
            value={brandId ? { label: filtersOptions?.brands.find(b => b.id === brandId)?.name ?? 'Marcas', value: brandId } : { label: 'Marcas', value: '' }}
            onChange={(option: any) => onBrandChange(option.value ? Number(option.value) : null)}
            options={[
              { label: 'Marcas', value: '' },
              ...(filtersOptions?.brands
                .filter((b) => !managerId || b.manager_id === managerId)
                .map((b) => ({ label: b.name, value: b.id })) || [])
            ]}
            className="w-full min-w-40 sm:w-auto"
            isLoading={isLoadingFilters}
          />
        </div>
      }
    />
  );
}
