import { Trophy } from "lucide-react";

import { EmptyState, PaginationBar } from "@/components/backoffice/Workbench";
import { MaterialTypeLabel } from "@/components/ui/MaterialTypeLabel";
import { ErrorState } from "@/components/ui/ErrorState";
import type { PaginatedData } from "@/types/backoffice";
import type { RepTopMaterial } from "@/types/repMetrics";

interface TopMaterialsListProps {
  data: PaginatedData<RepTopMaterial> | undefined;
  isLoading: boolean;
  isError: boolean;
  page: number;
  onPageChange: (page: number) => void;
}

/**
 * Materiales que el rep incluyó en sus sesiones, más abiertos por el médico
 * primero (materiales con 0 aperturas también aparecen — LEFT JOIN
 * semantics en el backend, así el rep ve qué NO está funcionando).
 */
export function TopMaterialsList({
  data,
  isLoading,
  isError,
  page,
  onPageChange,
}: TopMaterialsListProps) {
  return (
    <div className="rounded-3xl border border-border/50 bg-background/50 p-6 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <Trophy className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-display text-xl font-medium">Materiales más vistos</h3>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Unidad: veces abierto (un mismo material reabierto 3 veces suma 3), no
        médicos únicos. Filtra por fecha de apertura y solo cuenta materiales
        actualmente adjuntos a la sesión.
      </p>

      {isLoading && (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          Cargando…
        </div>
      )}

      {isError && <ErrorState message="No se pudieron cargar los materiales." />}

      {!isLoading && !isError && data?.items.length === 0 && (
        <EmptyState
          title="Sin materiales"
          description="Aún no has incluido materiales en tus sesiones."
        />
      )}

      {!isLoading && !isError && (data?.items.length ?? 0) > 0 && (
        <div className="flex flex-col gap-2">
          {data?.items.map((material, index) => {
            const openRate =
              material.distinct_sessions > 0
                ? Math.round((material.opens / material.distinct_sessions) * 100) / 100
                : 0;

            return (
              <div
                key={material.id}
                className="flex items-center gap-4 rounded-2xl border border-border/50 bg-background px-4 py-3"
              >
                <span className="w-6 shrink-0 text-center font-display text-lg font-semibold text-muted-foreground">
                  {index + 1 + (page - 1) * (data?.per_page ?? 20)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {material.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {material.distinct_sessions}{" "}
                    {material.distinct_sessions === 1 ? "sesión" : "sesiones"}
                    {material.distinct_sessions > 0 && (
                      <> · {openRate}x aperturas/sesión</>
                    )}
                  </p>
                </div>
                <MaterialTypeLabel type={material.type} />
                <span className="w-14 shrink-0 text-right font-display text-lg font-semibold tabular-nums text-foreground">
                  {material.opens}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {data && (
        <div className="mt-4">
          <PaginationBar
            page={data.page}
            lastPage={data.last_page}
            total={data.total}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
}
