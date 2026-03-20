import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar as CalendarIcon,
  FileIcon,
  Eye,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { metricsApi } from "@/services/metrics";
import { cn, formatDateTime } from "@/lib/utils";
import { AsyncMaterialSelect } from "@/components/ui/AsyncMaterialSelect";
import { DatePicker } from "@/components/ui/DatePicker";

interface MaterialViewsTableProps {
  materialIdFilter: string;
  setMaterialIdFilter: (val: string) => void;
  startDate: string;
  setStartDate: (val: string) => void;
  endDate: string;
  setEndDate: (val: string) => void;
}

export function MaterialViewsTable({
  materialIdFilter,
  setMaterialIdFilter,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}: MaterialViewsTableProps) {
  const [page, setPage] = useState(1);

  const { data: viewsResponse, isLoading } = useQuery({
    queryKey: [
      "metrics",
      "material-views-list",
      materialIdFilter,
      startDate,
      endDate,
      page,
    ],
    queryFn: () =>
      metricsApi
        .getMaterialViewsList({
          material_id: materialIdFilter ? Number(materialIdFilter) : undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          page,
        })
        .then((res) => res.data),
  });

  const viewsList = viewsResponse?.items || [];
  const meta = viewsResponse?.meta;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 mt-8">
      <div className="rounded-3xl border border-border/50 bg-background/50 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-xl font-display font-medium">
              Registro de Visualizaciones
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="w-full sm:w-auto min-w-[250px] max-w-[250px]">
              <AsyncMaterialSelect
                value={materialIdFilter}
                onChange={(val) => {
                  setMaterialIdFilter(val);
                  setPage(1);
                }}
                className="w-full"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <DatePicker
                value={startDate}
                onChange={(val) => {
                  setStartDate(val || "");
                  setPage(1);
                }}
                placeholder="Desde"
                className="w-[180px]"
              />
              <span className="text-muted-foreground text-sm">a</span>
              <DatePicker
                value={endDate}
                onChange={(val) => {
                  setEndDate(val || "");
                  setPage(1);
                }}
                placeholder="Hasta"
                className="w-[180px]"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border/50">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 rounded-t-lg">
              <tr>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Material</th>
                <th className="px-4 py-3 font-medium">Visualizador</th>
                <th className="px-4 py-3 font-medium">Representante</th>
                <th className="px-4 py-3 font-medium">Médico</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    Cargando datos...
                  </td>
                </tr>
              ) : viewsList?.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    No hay registros de visualizaciones para este filtro
                  </td>
                </tr>
              ) : (
                viewsList?.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {formatDateTime(item.opened_at)}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        {item.cover_path ? (
                          <img
                            src={`/api/v1/public/material/${item.material_id}/cover`}
                            alt="cover"
                            className="h-8 aspect-video object-cover rounded-md"
                          />
                        ) : (
                          <div className="h-8 aspect-video rounded-md bg-muted/50 flex items-center justify-center shrink-0">
                            <FileIcon className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-block align-middle truncate max-w-[200px] cursor-default">
                              {item.material_title}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">{item.material_title}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                          item.viewer_type === "doctor"
                            ? "bg-teal-500/10 text-teal-500"
                            : "bg-purple-500/10 text-purple-500",
                        )}
                      >
                        {item.viewer_type === "doctor" ? "Médico" : "Visitador"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-block align-middle truncate max-w-[200px] cursor-default">
                            {item.rep_name}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">{item.rep_name}</p>
                        </TooltipContent>
                      </Tooltip>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-block align-middle truncate max-w-[200px] cursor-default">
                            {item.doctor_name}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">{item.doctor_name}</p>
                        </TooltipContent>
                      </Tooltip>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Render Pagination if meta exists and has more than 1 page */}
          {meta && meta.last_page > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/50 bg-background/50">
              <div className="text-sm text-muted-foreground">
                Mostrando página{" "}
                <span className="font-medium text-foreground">{meta.page}</span>{" "}
                de{" "}
                <span className="font-medium text-foreground">
                  {meta.last_page}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={meta.page === 1}
                  className="inline-flex items-center justify-center rounded-lg border border-border bg-background p-2 text-sm font-medium hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                  aria-label="Anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() =>
                    setPage((p) => Math.min(meta.last_page, p + 1))
                  }
                  disabled={meta.page === meta.last_page}
                  className="inline-flex items-center justify-center rounded-lg border border-border bg-background p-2 text-sm font-medium hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                  aria-label="Siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
