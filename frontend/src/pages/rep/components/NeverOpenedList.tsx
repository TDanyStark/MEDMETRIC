import { Link } from "react-router-dom";
import { ArrowUpRight, UserX } from "lucide-react";

import { EmptyState, PaginationBar } from "@/components/backoffice/Workbench";
import { Badge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
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
import type { RepMetricSession } from "@/types/repMetrics";

interface NeverOpenedListProps {
  data: PaginatedData<RepMetricSession> | undefined;
  isLoading: boolean;
  isError: boolean;
  page: number;
  onPageChange: (page: number) => void;
  timezone?: string | null;
}

/**
 * Follow-up de médicos que NUNCA abrieron una sesión — probablemente lo
 * más accionable de todo el módulo (design "Jerarquía de la página").
 *
 * Tabla paginada (post-review fix): puede haber muchos médicos sin abrir,
 * así que esto es una `<Table>` (reutilizada, ver `OrgMaterialsTable` para
 * el mismo patrón) en vez de una lista de tarjetas. Pagina de a
 * `MetricsPaginationConfig::PAGE_SIZE` (10) — el backend
 * (`DbRepMetricsRepository::sessions()`) ya aplica esa constante; el
 * frontend no hardcodea el tamaño de página, solo refleja `data.per_page`
 * a través de `PaginationBar`. La página actual vive en la URL
 * (`never_page`, ver `RepMetricsPage`).
 *
 * Nota de implementación: `GET /rep/metrics/sessions` (spec/design) NO
 * expone `doctor_token`, así que este componente no puede copiar el link
 * público directamente aquí sin cambiar el contrato del backend (fuera de
 * alcance de este lote). En su lugar, cada fila enlaza al Historial ya
 * filtrado por el nombre del médico — ahí el rep ya tiene el botón de
 * copiar/abrir enlace (`RepHistoryPage` + `SessionViewBadge`, Fase 3),
 * a un solo clic de distancia. Cero cambios de backend, cero duplicación
 * de la lógica de compartir.
 */
export function NeverOpenedList({
  data,
  isLoading,
  isError,
  page,
  onPageChange,
  timezone,
}: NeverOpenedListProps) {
  return (
    <div className="rounded-3xl border border-amber-200/60 bg-amber-50/30 p-6 shadow-sm dark:border-amber-900/30 dark:bg-amber-950/10">
      <div className="mb-6 flex items-center gap-2">
        <UserX className="h-5 w-5 text-amber-600" />
        <h3 className="font-display text-xl font-medium">
          Médicos que nunca abrieron
        </h3>
      </div>

      {isLoading && (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          Cargando…
        </div>
      )}

      {isError && <ErrorState message="No se pudo cargar el seguimiento." />}

      {!isLoading && !isError && data?.items.length === 0 && (
        <EmptyState
          title="Todo al día"
          description="No hay sesiones sin abrir en este rango de fechas. Excelente."
        />
      )}

      {!isLoading && !isError && (data?.items.length ?? 0) > 0 && (
        <div className="overflow-hidden rounded-2xl border border-amber-200/70 bg-background dark:border-amber-900/40">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Médico</TableHead>
                <TableHead>Enviada</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items.map((session) => (
                <TableRow key={session.id}>
                  <TableCell className="font-medium text-foreground">
                    {session.doctor_name || (
                      <span className="italic text-muted-foreground">Sin nombre</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(session.created_at, timezone)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="warm" className="normal-case tracking-normal">
                      No vista
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      to={
                        session.doctor_name
                          ? `/rep/history?q=${encodeURIComponent(session.doctor_name)}`
                          : "/rep/history"
                      }
                      className="group inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
                    >
                      Ver en historial
                      <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </Link>
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
