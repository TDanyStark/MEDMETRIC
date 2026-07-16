import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileIcon, BookOpen } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PaginationBar } from "@/components/backoffice/Workbench";
import { metricsApi } from "@/services/metrics";
import { cn, formatDateTime } from "@/lib/utils";

interface StudyViewsTableProps {
  materialIds: number[];
  repIds: number[];
  startDate: string;
  endDate: string;
}

export function StudyViewsTable({
  materialIds,
  repIds,
  startDate,
  endDate,
}: StudyViewsTableProps) {
  const [page, setPage] = useState(1);

  const materialKey = materialIds.join(",");
  const repKey = repIds.join(",");

  // Reset to first page whenever any global filter changes.
  useEffect(() => {
    setPage(1);
  }, [materialKey, repKey, startDate, endDate]);

  const { data: viewsResponse, isLoading } = useQuery({
    queryKey: [
      "metrics",
      "study-views-list",
      materialKey,
      repKey,
      startDate,
      endDate,
      page,
    ],
    queryFn: () =>
      metricsApi
        .getStudyViewsList({
          material_id: materialIds.length ? materialIds : undefined,
          rep_id: repIds.length ? repIds : undefined,
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
        <div className="flex items-center gap-2 mb-6">
          <BookOpen className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-xl font-display font-medium">
            Registro de Visualizaciones de Estudios
          </h3>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border/50">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 rounded-t-lg">
              <tr>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Material</th>
                <th className="px-4 py-3 font-medium">Estudio</th>
                <th className="px-4 py-3 font-medium">Visualizador</th>
                <th className="px-4 py-3 font-medium">Representante</th>
                <th className="px-4 py-3 font-medium">Médico</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    Cargando datos...
                  </td>
                </tr>
              ) : viewsList?.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    No hay registros de visualizaciones de estudios para este filtro
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
                    <td className="px-4 py-3 text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-block align-middle line-clamp-2 max-w-[220px] cursor-default">
                            {item.study_title}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">{item.study_title}</p>
                        </TooltipContent>
                      </Tooltip>
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
                      {item.rep_name ? (
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
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.doctor_name ? (
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
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {meta && (
          <div className="mt-4">
            <PaginationBar
              page={meta.page}
              lastPage={meta.last_page}
              total={meta.total}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
