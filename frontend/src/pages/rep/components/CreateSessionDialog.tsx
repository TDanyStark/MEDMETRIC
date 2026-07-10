import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link2, Copy, UserPlus } from "lucide-react";
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
import { DoctorSelect } from "@/components/ui/DoctorSelect";
import { CreateDoctorDialog } from "@/components/doctors/CreateDoctorDialog";
import { createRepSession } from "@/services/rep";
import { Doctor } from "@/types/doctor";

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
    notes: "",
  });
  const [doctorId, setDoctorId] = useState<number | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [doctorSearchInput, setDoctorSearchInput] = useState("");
  const [isCreateDoctorOpen, setIsCreateDoctorOpen] = useState(false);
  const [showDoctorError, setShowDoctorError] = useState(false);
  const [createdSessionToken, setCreatedSessionToken] = useState<string | null>(
    null,
  );

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      if (selectedMaterialIds.length === 0)
        throw new Error("Selecciona al menos un material.");
      if (!doctorId) throw new Error("Selecciona un médico para continuar.");
      return createRepSession({
        doctor_id: doctorId,
        notes: sessionForm.notes || undefined,
        material_ids: selectedMaterialIds,
      });
    },
    onSuccess: (data) => {
      toast.success("Sesión médica creada exitosamente.");
      setCreatedSessionToken(data.session.doctor_token);
      setSessionForm({ notes: "" });
      setDoctorId(null);
      setSelectedDoctor(null);
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
    setShowDoctorError(false);
  };

  const handleDoctorCreated = (doctor: Doctor) => {
    setDoctorId(doctor.id);
    setSelectedDoctor(doctor);
    setShowDoctorError(false);
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
    <>
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        onPointerDownOutside={event => {
          const target = event.target as HTMLElement | null
          if (target?.closest('.doctor-select__menu, [class*="doctor-select__"]')) {
            event.preventDefault()
          }
        }}
        onInteractOutside={event => {
          const target = event.target as HTMLElement | null
          if (target?.closest('.doctor-select__menu, [class*="doctor-select__"]')) {
            event.preventDefault()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Crear Visita Médica</DialogTitle>
          <DialogDescription>
            Selecciona al médico que vas a visitar y, si quieres, agrega notas.
            El enlace que generes incluirá los {selectedMaterialIds.length}{" "}
            materiales seleccionados.
          </DialogDescription>
        </DialogHeader>

        {!createdSessionToken ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!doctorId) {
                setShowDoctorError(true);
                return;
              }
              void createSessionMutation.mutateAsync();
            }}
            className="space-y-5 mt-4"
          >
            <div className="flex flex-col gap-2">
              <label className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Médico
              </label>
              <DoctorSelect
                value={doctorId}
                onChange={(id, doctor) => {
                  setDoctorId(id);
                  setSelectedDoctor(doctor);
                  if (id) setShowDoctorError(false);
                }}
                onInputChange={setDoctorSearchInput}
                instanceId="create-session-doctor-select"
              />
              {showDoctorError && (
                <p className="text-xs text-destructive">
                  Selecciona un médico para continuar.
                </p>
              )}
              {selectedDoctor?.specialty && (
                <p className="text-xs text-muted-foreground">
                  {selectedDoctor.specialty}
                </p>
              )}
              <button
                type="button"
                onClick={() => setIsCreateDoctorOpen(true)}
                className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
              >
                <UserPlus className="h-3.5 w-3.5" />+ Registrar nuevo médico
              </button>
            </div>
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
              <Button
                type="submit"
                disabled={!doctorId}
                loading={createSessionMutation.isPending}
              >
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

    <CreateDoctorDialog
      open={isCreateDoctorOpen}
      onOpenChange={setIsCreateDoctorOpen}
      onCreated={handleDoctorCreated}
      initialName={doctorSearchInput}
    />
    </>
  );
}
