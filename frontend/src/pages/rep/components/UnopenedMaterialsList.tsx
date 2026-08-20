import { FileX2 } from "lucide-react";

import { EmptyState, PaginationBar } from "@/components/backoffice/Workbench";
import { ErrorState } from "@/components/ui/ErrorState";
import { MaterialTypeLabel } from "@/components/ui/MaterialTypeLabel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { formatDate } from "@/lib/utils";
import type { PaginatedData } from "@/types/backoffice";
import type { RepUnopenedMaterial } from "@/types/repMetrics";

interface UnopenedMaterialsListProps {
  data: PaginatedData<RepUnopenedMaterial> | undefined;
  isLoading: boolean;
  isError: boolean;
  page: number;
  onPageChange: (page: number) => void;
  timezone?: string | null;
}

/**
 * Per-material breakdown of the "materiales sin abrir" stat chip in
 * `OpenRateHero` (`summary().materials_unopened`) — the table answers
 * "¿CUÁLES materiales quedaron sin ver?", which the tarjeta alone can't
 * show. NEW endpoint (`GET /rep/metrics/unopened-materials`), pair-level
 * (session, material) — reuses the exact same `<Table>` + `PaginationBar`
 * + `EmptyState` pattern already established by `NeverOpenedList` (10/page
 * via `MetricsPaginationConfig::PAGE_SIZE`, page persisted in the URL).
 *
 * Deliberately NOT styled like `NeverOpenedList`'s amber "alert" card:
 * that box answers a session-level question ("¿qué médicos no
 * interactuaron en absoluto?"). This one is neutral (same
 * `border-border/50 bg-background/50` surface as `TopMaterialsList`)
 * because most rows here belong to sessions where the doctor DID open
 * something else — it's a follow-up detail list, not an alert. The
 * subtitle below makes that distinction explicit so nobody reads this as
 * a subset of the médicos-que-nunca-abrieron list above it.
 */
export function UnopenedMaterialsList({
  data,
  isLoading,
  isError,
  page,
  onPageChange,
  timezone,
}: UnopenedMaterialsListProps) {
  return (
    <div className="rounded-3xl border border-border/50 bg-background/50 p-6 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <FileX2 className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-display text-xl font-medium">Materiales sin abrir</h3>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Distinto de &ldquo;Médicos que nunca abrieron&rdquo;: acá el médico pudo haber
        abierto otro material de la misma sesión — esto lista el material puntual
        que quedó sin ver.
      </p>

      {isLoading && (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          Cargando…
        </div>
      )}

      {isError && <ErrorState message="No se pudieron cargar los materiales sin abrir." />}

      {!isLoading && !isError && data?.items.length === 0 && (
        <EmptyState
          title="Todos los materiales fueron abiertos"
          description="No hay materiales pendientes de apertura en este rango. Buen trabajo."
        />
      )}

      {!isLoading && !isError && (data?.items.length ?? 0) > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-background">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Médico</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Enviado</TableHead>
                <TableHead className="text-right">Días</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items.map((row) => (
                <TableRow key={`${row.session_id}-${row.material_id}`}>
                  <TableCell className="font-medium text-foreground">
                    {row.doctor_name || (
                      <span className="italic text-muted-foreground">Sin nombre</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <MaterialTypeLabel type={row.material_type} />
                      <span className="truncate text-sm text-foreground">
                        {row.material_title}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(row.sent_at, timezone)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {row.days_elapsed} {row.days_elapsed === 1 ? "día" : "días"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {data && (
        <div className="mt-4">
          <PaginationBar
            page={data.page ?? page}
            lastPage={data.last_page}
            total={data.total}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
}
