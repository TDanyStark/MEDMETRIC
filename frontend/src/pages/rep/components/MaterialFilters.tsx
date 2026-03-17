import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SearchToolbar } from "@/components/backoffice/Workbench";
import { Select } from "@/components/ui/Select";
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

          <Select
            value={type}
            onChange={(e) => onTypeChange(e.target.value)}
            className="h-11 w-full min-w-30 sm:w-auto"
          >
            <option value="all">Tipos</option>
            <option value="pdf">PDF</option>
            <option value="video">Video</option>
            <option value="link">Link</option>
          </Select>

          <Select
            value={managerId?.toString() ?? ""}
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : null;
              onManagerChange(val);
            }}
            className="h-11 w-full min-w-45 sm:w-auto"
            disabled={isLoadingFilters}
          >
            <option value="">Gerentes</option>
            {filtersOptions?.managers.map((m) => (
              <option key={m.manager_id} value={m.manager_id}>
                {m.manager_name}
              </option>
            ))}
          </Select>

          <Select
            value={brandId?.toString() ?? ""}
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : null;
              onBrandChange(val);
            }}
            className="h-11 w-full min-w-40 sm:w-auto"
            disabled={isLoadingFilters}
          >
            <option value="">Marcas</option>
            {filtersOptions?.brands
              .filter((b) => !managerId || b.manager_id === managerId)
              .map((b) => (
                <option key={`${b.id}-${b.manager_id}`} value={b.id}>
                  {b.name}
                </option>
              ))}
          </Select>
        </div>
      }
    />
  );
}
