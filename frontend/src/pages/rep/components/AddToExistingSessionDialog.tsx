import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, CheckCircle2, PackagePlus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SearchToolbar } from "@/components/backoffice/Workbench";
import { Badge } from "@/components/ui/Badge";
import { listRepSessions, addMaterialsToSession } from "@/services/rep";
import { RepSession } from "@/types/rep";
import { formatDateTime } from "@/lib/utils";
import { LoadingState } from "@/components/ui/LoadingState";

interface AddToExistingSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedMaterialIds: number[];
  onSuccess: () => void;
}

export function AddToExistingSessionDialog({
  open,
  onOpenChange,
  selectedMaterialIds,
  onSuccess,
}: AddToExistingSessionDialogProps) {
  const queryClient = useQueryClient();
  const [sessionSearch, setSessionSearch] = useState("");
  const [targetSessionForAdd, setTargetSessionForAdd] =
    useState<RepSession | null>(null);
  const [addDone, setAddDone] = useState(false);

  // Fetch recent sessions to allow "add to existing"
  const sessionsQuery = useQuery({
    queryKey: ["rep", "sessions", 1, sessionSearch],
    queryFn: () => listRepSessions({ page: 1, q: sessionSearch || undefined }),
    enabled: open,
  });

  const addToExistingMutation = useMutation({
    mutationFn: () => {
      if (!targetSessionForAdd) throw new Error("No hay sesión seleccionada.");
      return addMaterialsToSession(targetSessionForAdd.id, selectedMaterialIds);
    },
    onSuccess: () => {
      toast.success("Materiales agregados a la sesión.");
      setAddDone(true);
      void queryClient.invalidateQueries({ queryKey: ["rep", "sessions"] });
      onSuccess();
    },
    onError: (err) => {
      const msg =
        err instanceof Error ? err.message : "Error al agregar materiales.";
      toast.error(msg);
    },
  });

  const handleClose = () => {
    onOpenChange(false);
    setTargetSessionForAdd(null);
    setSessionSearch("");
    setAddDone(false);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Enlace copiado al portapapeles");
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar a sesión existente</DialogTitle>
          <DialogDescription>
            Selecciona la sesión a la que deseas agregar los{" "}
            {selectedMaterialIds.length} materiales seleccionados.
          </DialogDescription>
        </DialogHeader>

        {addDone ? (
          <div className="mt-4 flex flex-col items-center gap-6 py-4">
            <div className="p-4 bg-success/10 text-success rounded-full">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-lg text-foreground">
                ¡Materiales agregados!
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                El enlace de la sesión ya incluye los nuevos materiales.
              </p>
            </div>
            {targetSessionForAdd && (
              <div className="flex w-full items-center gap-2">
                <Input
                  readOnly
                  value={`${window.location.origin}/public/visit/${targetSessionForAdd.doctor_token}`}
                  className="flex-1"
                />
                <Button
                  variant="secondary"
                  onClick={() =>
                    copyToClipboard(
                      `${window.location.origin}/public/visit/${targetSessionForAdd!.doctor_token}`,
                    )
                  }
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            )}
            <Button className="w-full" onClick={handleClose}>
              Cerrar
            </Button>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <SearchToolbar
              value={sessionSearch}
              onChange={setSessionSearch}
              placeholder="Buscar médico..."
            />
            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {sessionsQuery.isLoading && (
                <LoadingState message="Cargando sesiones..." />
              )}
              {sessionsQuery.data?.items.map((session) => (
                <div
                  key={session.id}
                  onClick={() =>
                    setTargetSessionForAdd((s) =>
                      s?.id === session.id ? null : session,
                    )
                  }
                  className={`flex items-center gap-3 cursor-pointer rounded-2xl border p-4 transition-all ${
                    targetSessionForAdd?.id === session.id
                      ? "ring-2 ring-primary border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div
                    className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      targetSessionForAdd?.id === session.id
                        ? "bg-primary border-primary"
                        : "border-muted-foreground/30"
                    }`}
                  >
                    {targetSessionForAdd?.id === session.id && (
                      <div className="h-2 w-2 rounded-full bg-background" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {session.doctor_name || (
                        <span className="italic text-muted-foreground">
                          Sin nombre
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(session.created_at)}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-xs">
                    ID {session.id}
                  </Badge>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                disabled={!targetSessionForAdd}
                loading={addToExistingMutation.isPending}
                onClick={() => void addToExistingMutation.mutateAsync()}
              >
                <PackagePlus className="mr-2 h-4 w-4" /> Agregar materiales
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
