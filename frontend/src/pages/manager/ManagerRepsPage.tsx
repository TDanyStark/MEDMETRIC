import { useState } from "react";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { UsersRound, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";

import {
  ChoicePills,
  EmptyState,
  PaginationBar,
  SearchToolbar,
} from "@/components/backoffice/Workbench";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";

import {
  getBooleanParam,
  getNumberParam,
  getStringParam,
  updateSearchParams,
} from "@/lib/search";
import { formatDate } from "@/lib/utils";
import {
  assignManagerReps,
  listAvailableManagerReps,
  listManagerReps,
  removeManagerRep,
} from "@/services/backoffice";
import { LoadingState } from "./components/ManagerHelpers";

export function ManagerRepsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = getStringParam(searchParams, "q");
  const availableQ = getStringParam(searchParams, "available_q");
  const page = getNumberParam(searchParams, "page");
  const activeFilter = getBooleanParam(searchParams, "active");

  const [assignedQuery, availableQuery] = useQueries({
    queries: [
      {
        queryKey: ["manager", "reps", q, page, activeFilter],
        queryFn: () => listManagerReps({ q, page, active: activeFilter }),
      },
      {
        queryKey: ["manager", "reps", "available", availableQ],
        queryFn: () => listAvailableManagerReps({ q: availableQ }),
      },
    ],
  });

  const [selectedRepIds, setSelectedRepIds] = useState<number[]>([]);

  const assignMutation = useMutation({
    mutationFn: () => assignManagerReps(selectedRepIds),
    onSuccess: () => {
      toast.success("Visitadores asignados.");
      setSelectedRepIds([]);
      void queryClient.invalidateQueries({ queryKey: ["manager", "reps"] });
    },
    onError: () => {
      toast.error("Error al asignar.");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (repId: number) => removeManagerRep(repId),
    onSuccess: () => {
      toast.success("Visitador removido.");
      void queryClient.invalidateQueries({ queryKey: ["manager", "reps"] });
    },
    onError: () => {
      toast.error("Error al quitar visitador.");
    },
  });

  return (
    <div className="mx-auto flex flex-col md:flex-row w-full max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:px-8 animate-in fade-in duration-500">
      {/* Left side: Add reps */}
      <div className="w-full md:w-1/3 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-display font-semibold tracking-tight text-foreground">
            Distribución
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Busca candidatos de la organización para suscribirlos a tus
            materiales.
          </p>
        </div>

        <SearchToolbar
          value={availableQ ?? ""}
          onChange={(value) =>
            setSearchParams((current) =>
              updateSearchParams(current, { available_q: value || null }),
            )
          }
          placeholder="Buscar candidato..."
        />

        <div className="bg-background/50 rounded-3xl border border-border/50 p-6 shadow-sm flex flex-col gap-6 flex-1 max-h-[60vh] overflow-y-auto">
          {availableQuery.isLoading && <LoadingState message="Buscando..." />}
          {!availableQuery.isLoading &&
            (availableQuery.data?.length ?? 0) === 0 && (
              <EmptyState
                title="Candidatos"
                description="Busca para encontrar gente libre"
              />
            )}

          <ChoicePills
            value={selectedRepIds}
            onToggle={(repId) =>
              setSelectedRepIds((current) =>
                current.includes(repId)
                  ? current.filter((item) => item !== repId)
                  : [...current, repId],
              )
            }
            options={(availableQuery.data ?? []).map((item) => ({
              value: item.id,
              label: item.name,
              hint: item.email,
            }))}
          />

          {selectedRepIds.length > 0 && (
            <div className="flex flex-col gap-3 mt-4 pt-6 border-t border-border/20 sticky bottom-0 bg-background/50 backdrop-blur pb-2">
              <Button
                disabled={selectedRepIds.length === 0}
                loading={assignMutation.isPending}
                onClick={() => void assignMutation.mutateAsync()}
              >
                Conectar ({selectedRepIds.length} ref)
              </Button>
              <Button variant="ghost" onClick={() => setSelectedRepIds([])}>
                Limpiar
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Right side: Active reps */}
      <div className="w-full md:w-2/3 flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-display font-semibold tracking-tight text-foreground">
              Visitadores
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Equipo de campo que consume tus recursos actuales.
            </p>
          </div>
        </div>

        <SearchToolbar
          value={q ?? ""}
          onChange={(value) =>
            setSearchParams((current) =>
              updateSearchParams(current, { q: value || null, page: 1 }),
            )
          }
          placeholder="Buscar en el equipo..."
        />

        {assignedQuery.isLoading && (
          <LoadingState message="Cargando equipo..." />
        )}

        {!assignedQuery.isLoading &&
          !assignedQuery.isError &&
          assignedQuery.data?.items.length === 0 && (
            <div className="flex-1 min-h-[40vh] rounded-3xl border border-dashed border-border/50 flex flex-col items-center justify-center text-muted-foreground bg-muted/10 p-8 text-center gap-4">
              <UsersRound className="w-12 h-12 opacity-20" />
              <p>
                Nadie asignado.
                <br />
                Agrega visitadores de la columna izquierda para empezar a
                destinarles material.
              </p>
            </div>
          )}

        {!assignedQuery.isLoading &&
          !assignedQuery.isError &&
          (assignedQuery.data?.items.length ?? 0) > 0 && (
            <div className="rounded-3xl border border-border/50 bg-background/50 shadow-sm overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="w-[40%]">Visitador</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Alta</TableHead>
                    <TableHead className="text-right">Descartar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignedQuery.data?.items.map((item) => (
                    <TableRow
                      key={item.id}
                      className="group transition-colors hover:bg-muted/20"
                    >
                      <TableCell className="font-medium text-foreground">
                        {item.rep.name}
                        <p className="text-xs text-muted-foreground">
                          {item.rep.email}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.active ? "success" : "outline"}>
                          {item.active ? "Activo" : "Pausado"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(item.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end pr-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            loading={
                              removeMutation.isPending &&
                              removeMutation.variables === item.rep_id
                            }
                            onClick={() =>
                              void removeMutation.mutateAsync(item.rep_id)
                            }
                            className="opacity-70 hover:opacity-100 hover:text-destructive transition-opacity"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

        <PaginationBar
          page={assignedQuery.data?.page ?? page}
          lastPage={assignedQuery.data?.last_page ?? 1}
          total={assignedQuery.data?.total ?? 0}
          onPageChange={(nextPage) =>
            setSearchParams((current) =>
              updateSearchParams(current, { page: nextPage }),
            )
          }
        />
      </div>
    </div>
  );
}
