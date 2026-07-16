import { FileText, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Separator } from "@/components/ui/Separator";
import { Material } from "@/types/rep";
import { MaterialTypeLabel } from "@/components/ui/MaterialTypeLabel";
import { formatDate } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MaterialCardProps {
  item: Material;
  isSelected: boolean;
  onToggle: (id: number) => void;
  onPreview: (item: Material) => void;
}

export function MaterialCard({
  item,
  isSelected,
  onToggle,
  onPreview,
}: MaterialCardProps) {
  const firstStudy = item.studies?.[0];
  const extraStudiesCount = item.studies ? item.studies.length - 1 : 0;
  const FirstStudyIcon = firstStudy
    ? firstStudy.type === "pdf"
      ? FileText
      : ExternalLink
    : null;

  return (
    <Card
      className={`group overflow-hidden transition-all duration-300 h-full flex flex-col ${
        isSelected
          ? "ring-2 ring-primary bg-primary/5 shadow-md"
          : "hover:border-primary/50 hover:shadow-lg border-border/40 bg-background/50 backdrop-blur-sm"
      }`}
    >
      <div className="relative aspect-video bg-muted border-b border-border/10 overflow-hidden shrink-0">
        {item.cover_url || item.cover_path ? (
          <img
            src={item.cover_url || `/api/v1/public/material/${item.id}/cover`}
            className="w-full aspect-video object-cover transition-transform duration-500 group-hover:scale-110"
            alt={item.title}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center opacity-20 transition-transform duration-500 group-hover:scale-110">
            <FileText className="h-12 w-12" />
            <span className="text-[10px] font-bold mt-2 uppercase tracking-widest">
              {item.type}
            </span>
          </div>
        )}
        <div className="absolute top-3 left-3">
          <MaterialTypeLabel type={item.type} />
        </div>
        <button
          type="button"
          onClick={() => onToggle(item.id)}
          aria-pressed={isSelected}
          aria-label={
            isSelected ? "Quitar de la selección" : "Agregar a la selección"
          }
          className={`absolute top-3 right-3 h-5 w-5 cursor-pointer rounded-full border flex items-center justify-center shadow-sm transition-all duration-300 ${
            isSelected
              ? "bg-primary border-primary scale-110"
              : "bg-background/80 border-muted-foreground/30 scale-100 hover:border-primary/60 hover:scale-105"
          }`}
        >
          {isSelected && <div className="h-2 w-2 rounded-full bg-background" />}
        </button>
      </div>
      <CardContent className="p-4 pt-3 flex-1 flex flex-col">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-2">
          <span>MAT-{item.id}</span>
          <span>{formatDate(item.created_at)}</span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <h3 className="font-bold leading-tight min-h-[2.5rem]">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPreview(item);
                }}
                className="line-clamp-2 cursor-pointer text-left text-foreground transition-colors hover:text-primary hover:underline"
              >
                {item.title}
              </button>
            </h3>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="text-xs">{item.title}</p>
          </TooltipContent>
        </Tooltip>
        {item.description && (
          <p className="mt-2 text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed min-h-[2.5rem] opacity-80">
            {item.description}
          </p>
        )}
        {firstStudy && FirstStudyIcon && (
          <>
            <Separator className="mt-3 mb-3" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPreview(item);
              }}
              className="-mx-1 cursor-pointer rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-muted/50"
            >
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-1.5">
                Estudios relacionados
              </p>
              <div className="flex items-center gap-1.5 min-w-0">
                <FirstStudyIcon className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                <span className="truncate text-[11px] text-muted-foreground/70">
                  {firstStudy.title}
                </span>
                {extraStudiesCount > 0 && (
                  <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold leading-none text-muted-foreground/70">
                    +{extraStudiesCount}
                  </span>
                )}
              </div>
            </button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
