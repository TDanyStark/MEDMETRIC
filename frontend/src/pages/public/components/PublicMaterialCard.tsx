import { FileText, MessageSquarePlus, Share2 } from "lucide-react";
import { copyVisitShareMessage } from "@/lib/shareVisitLink";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Separator } from "@/components/ui/Separator";
import { PublicMaterial, PublicSession, PublicStudy } from "@/types";
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
  session: PublicSession;
  shareUrl?: string;
  getStudyHref?: (study: PublicStudy) => string;
  onComment?: (material: PublicMaterial) => void;
}

/**
 * A single material card in the public visit view.
 *
 * The whole thing renders as ONE continuous card (image, badges, title,
 * description and related studies all live inside the same `<Card>`
 * wrapper). Both the cover image AND the material TITLE open the
 * material (same href/target), related studies keep their own
 * independent click targets (see PublicStudyListItem), and the
 * "Comentar" button at the bottom of the card opens the comment
 * composer preselected to THIS material (see `onComment`).
 */
export function PublicMaterialCard({
  item,
  isActive,
  href,
  showShare = false,
  session,
  shareUrl,
  getStudyHref,
  onComment,
}: PublicMaterialCardProps) {
  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    void copyVisitShareMessage(session.doctor_token, session.doctor_name, {
      repName: session.rep_name,
      organizationName: session.organization_name,
    }, shareUrl);
  };

  const handleComment = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onComment?.(item);
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
      {/* Cover — opens the material, same target as the title link */}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block aspect-video shrink-0 overflow-hidden border-b border-border/10 bg-muted"
      >
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
                <p className="text-[10px]">Copiar mensaje para médico</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </a>

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

        {onComment && (
          <div className="mt-auto pt-3">
            <Separator className="mb-2.5" />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
              onClick={handleComment}
            >
              <MessageSquarePlus className="h-3.5 w-3.5" />
              Comentar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
