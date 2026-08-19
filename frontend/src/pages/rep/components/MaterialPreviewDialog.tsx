import { useEffect, useState } from "react";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Material } from "@/types/rep";
import { MaterialResource } from "@/types";
import { MaterialStudy } from "@/types/backoffice";
import { getRepMaterialPreview, getRepStudyPreview } from "@/services/rep";
import { useDidDepsChange } from "@/hooks/useDidDepsChange";
import { RepStudyListItem } from "./RepStudyListItem";

interface MaterialPreviewDialogProps {
  material: Material | null;
  onClose: () => void;
}

export function MaterialPreviewDialog({
  material,
  onClose,
}: MaterialPreviewDialogProps) {
  const [resource, setResource] = useState<MaterialResource | null>(null);
  const [activeStudy, setActiveStudy] = useState<MaterialStudy | null>(null);
  const [studyResource, setStudyResource] = useState<MaterialResource | null>(
    null,
  );

  // Reset the study drill-down whenever the previewed material changes.
  // Adjusted during render, not in an effect.
  if (useDidDepsChange([material])) {
    setActiveStudy(null);
    setStudyResource(null);
    if (!material) {
      setResource(null);
    }
  }

  // Genuine async effect: fetches the material's preview resource. Stays
  // an effect since a network call can't be run during render.
  useEffect(() => {
    if (!material) return;
    const fetchResource = async () => {
      try {
        const data = await getRepMaterialPreview(material.id);
        setResource(data);
      } catch {
        toast.error("No se pudo cargar la previsualización");
      }
    };
    void fetchResource();
  }, [material]);

  const handleOpenStudy = async (study: MaterialStudy) => {
    try {
      const data = await getRepStudyPreview(study.id);
      setActiveStudy(study);
      setStudyResource(data);
    } catch {
      toast.error("No se pudo cargar la previsualización del estudio");
    }
  };

  const handleBackToMaterial = () => {
    setActiveStudy(null);
    setStudyResource(null);
  };

  const activeResource = activeStudy ? studyResource : resource;
  const activeTitle = activeStudy ? activeStudy.title : material?.title;

  return (
    <Dialog open={!!material} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-[90vw] max-h-[90vh] p-0 bg-background gap-0 sm:rounded-xl flex flex-col overflow-hidden">
        <DialogHeader className="p-4 border-b bg-muted/20 shrink-0">
          {activeStudy && (
            <button
              type="button"
              onClick={handleBackToMaterial}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Volver a {material?.title}
            </button>
          )}
          <DialogTitle className="text-lg font-semibold">
            {activeTitle}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col relative w-full h-[50vh] shrink-0 bg-muted/5">
          {!activeResource ? (
            <div className="flex h-full items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : activeResource.type === "pdf" ? (
            <iframe
              title={activeTitle}
              src={`${activeResource.url}#toolbar=0`}
              className="h-full w-full border-none bg-muted/20"
            />
          ) : activeResource.type === "video" ? (
            <div className="flex h-full w-full items-center justify-center bg-black">
              <iframe
                title={activeTitle}
                src={activeResource.embed_url ?? activeResource.url}
                className="w-full aspect-video max-h-full border-none"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : activeResource.type === "link" ? (
            <div className="flex h-full flex-col items-center justify-center p-10 text-center">
              <div className="rounded-full bg-amber-500/10 p-8 mb-6 ring-1 ring-amber-500/20">
                <ExternalLink className="h-12 w-12 text-amber-600" />
              </div>
              <h3 className="text-2xl font-bold text-foreground">
                {activeTitle}
              </h3>
              <p className="mt-4 max-w-md text-base text-muted-foreground mb-8">
                Este {activeStudy ? "estudio" : "material"} es un enlace
                externo. Ábrelo para visualizar el contenido en una nueva
                pestaña.
              </p>
              <Button
                size="lg"
                onClick={() =>
                  window.open(
                    activeResource.url ?? material?.external_url ?? "",
                    "_blank",
                  )
                }
              >
                Abrir enlace externo <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Contenido no disponible.
            </div>
          )}
        </div>
        {!activeStudy && material?.studies && material.studies.length > 0 && (
          <div className="flex-1 min-h-0 overflow-y-auto border-t border-border/40 bg-muted/10 p-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">
              Estudios relacionados
            </p>
            <div className="flex flex-col gap-1.5">
              {material.studies.map((study) => (
                <RepStudyListItem
                  key={study.id}
                  study={study}
                  onClick={() => void handleOpenStudy(study)}
                />
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
