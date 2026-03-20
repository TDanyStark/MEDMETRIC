import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link2, Copy } from "lucide-react";
import { Link } from "react-router-dom";
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
import { Textarea } from "@/components/ui/Textarea";
import { createRepSession } from "@/services/rep";

interface CreateSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedMaterialIds: number[];
  onSuccess: () => void;
}

export function CreateSessionDialog({
  open,
  onOpenChange,
  selectedMaterialIds,
  onSuccess,
}: CreateSessionDialogProps) {
  const queryClient = useQueryClient();
  const [sessionForm, setSessionForm] = useState({
    doctor_name: "",
    notes: "",
  });
  const [createdSessionToken, setCreatedSessionToken] = useState<string | null>(
    null,
  );

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      if (selectedMaterialIds.length === 0)
        throw new Error("Selecciona al menos un material.");
      return createRepSession({
        doctor_name: sessionForm.doctor_name || undefined,
        notes: sessionForm.notes || undefined,
        material_ids: selectedMaterialIds,
      });
    },
    onSuccess: (data) => {
      toast.success("Sesión médica creada exitosamente.");
      setCreatedSessionToken(data.session.doctor_token);
      setSessionForm({ doctor_name: "", notes: "" });
      void queryClient.invalidateQueries({ queryKey: ["rep", "sessions"] });
      onSuccess();
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "Error al crear la sesión.";
      toast.error(message);
    },
  });

  const handleClose = () => {
    onOpenChange(false);
    setCreatedSessionToken(null);
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
          <DialogTitle>Crear Visita Médica</DialogTitle>
          <DialogDescription>
            Registra notas o a quién visitas (opcional). El enlace que generes
            incluirá los {selectedMaterialIds.length} materiales seleccionados.
          </DialogDescription>
        </DialogHeader>

        {!createdSessionToken ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void createSessionMutation.mutateAsync();
            }}
            className="space-y-5 mt-4"
          >
            <Input
              label="Médico (Opcional)"
              value={sessionForm.doctor_name}
              onChange={(e) =>
                setSessionForm((c) => ({ ...c, doctor_name: e.target.value }))
              }
              placeholder="Dr. Juan Pérez"
            />
            <Textarea
              label="Notas de la visita (Opcional)"
              value={sessionForm.notes}
              onChange={(e) =>
                setSessionForm((c) => ({ ...c, notes: e.target.value }))
              }
              placeholder="Interés en cardiopatías..."
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button type="submit" loading={createSessionMutation.isPending}>
                Generar Link
              </Button>
            </div>
          </form>
        ) : (
          <div className="mt-4 flex flex-col items-center gap-6">
            <div className="p-4 bg-success/10 text-success rounded-full">
              <Link2 className="h-8 w-8" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-lg text-foreground">
                ¡Sesión lista para compartir!
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Comparte este enlace con el médico. No requiere inicio de
                sesión.
              </p>
            </div>
            <div className="flex w-full items-center gap-2">
              <Input
                readOnly
                value={`${window.location.origin}/public/visit/${createdSessionToken}`}
                className="w-[250px]"
              />
              <Button
                variant="secondary"
                onClick={() =>
                  copyToClipboard(
                    `${window.location.origin}/public/visit/${createdSessionToken}`,
                  )
                }
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex w-full gap-3 pt-4 border-t border-border mt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleClose}
              >
                Cerrar
              </Button>
              <Button className="flex-1" asChild>
                <Link
                  to={`/public/visit/${createdSessionToken}`}
                  target="_blank"
                >
                  Abrir link
                </Link>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
