import { FileText, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Separator } from "@/components/ui/Separator";
import { PublicMaterial, PublicStudy } from "@/types";
import { MaterialTypeLabel } from "@/components/ui/MaterialTypeLabel";
import { PublicStudyListItem } from "./PublicStudyListItem";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PublicMaterialCardProps {
  item: PublicMaterial;
  isActive: boolean;
  href: string;
  showShare?: boolean;
  shareUrl?: string;
  getStudyHref?: (study: PublicStudy) => string;
}

/**
 * A single material card in the public visit view.
 *
 * The whole thing renders as ONE continuous card (image, badges, title,
 * description and related studies all live inside the same `<Card>`
 * wrapper). Only the material TITLE opens the material — the cover image
 * is purely decorative and non-interactive, while related studies keep
 * their own independent click targets (see PublicStudyListItem).
 */
export function PublicMaterialCard({
  item,
  isActive,
  href,
  showShare = false,
  shareUrl,
  getStudyHref,
}: PublicMaterialCardProps) {
  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!shareUrl) return;

    navigator.clipboard.writeText(shareUrl)
      .then(() => toast.success("Enlace para el médico copiado con éxito"))
      .catch(() => toast.error("No se pudo copiar el enlace"));
  };

  const studies = item.studies ?? [];
  const hasStudies = studies.length > 0 && !!getStudyHref;

  return (
    <Card
      className={`group relative isolate flex h-full flex-col overflow-hidden transition-all duration-300 ${
        isActive
          ? "ring-2 ring-primary bg-primary/5 shadow-lg shadow-primary/10"
          : "hover:border-primary/50 hover:shadow-md border-border/50 bg-background/50 backdrop-blur-sm"
      }`}
    >
      {/* Cover — decorative only, not clickable */}
      <div className="relative aspect-video shrink-0 overflow-hidden border-b border-border/10 bg-muted">
        {item.cover_url || item.cover_path ? (
          <img
            src={item.cover_url || `/api/v1/public/material/${item.id}/cover`}
            className="aspect-video w-full object-cover transition-transform duration-500 group-hover:scale-110"
            alt={item.title}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center opacity-20 transition-transform duration-500 group-hover:scale-110">
            <FileText className="h-10 w-10" />
            <span className="mt-2 text-[8px] font-bold uppercase tracking-widest">
              {item.type}
            </span>
          </div>
        )}

        <div className="absolute top-2.5 left-2.5 scale-90 origin-top-left">
          <MaterialTypeLabel type={item.type} />
        </div>

        {showShare && shareUrl && (
          <div className="absolute top-2.5 right-2.5 z-20">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 rounded-full border-border/30 bg-background/90 p-0 shadow-xl transition-all duration-300 hover:bg-primary hover:text-white"
                  onClick={handleShare}
                >
                  <Share2 className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p className="text-[10px]">Copiar link para médico</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>

      <CardContent className="flex flex-1 flex-col p-3">
        <p className="mb-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60">
          Material #{item.id}
        </p>

        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={`min-h-[2.5rem] cursor-pointer text-sm font-semibold leading-tight line-clamp-2 underline-offset-2 transition-colors hover:underline ${
                isActive ? "text-primary" : "text-foreground hover:text-primary"
              }`}
            >
              {item.title}
            </a>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="z-50">
            <p className="max-w-xs text-xs">{item.title}</p>
          </TooltipContent>
        </Tooltip>

        {item.description && (
          <p className="mt-1.5 min-h-[2.25rem] text-[10px] leading-[1.3] text-muted-foreground opacity-80 line-clamp-2">
            {item.description}
          </p>
        )}

        {hasStudies && (
          <div className="mt-3 flex flex-1 flex-col">
            <Separator className="mb-2.5" />
            <p className="mb-1.5 px-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50">
              Estudios relacionados
            </p>
            <div className="flex flex-col gap-1">
              {studies.map((study) => (
                <PublicStudyListItem
                  key={study.id}
                  study={study}
                  href={getStudyHref!(study)}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
