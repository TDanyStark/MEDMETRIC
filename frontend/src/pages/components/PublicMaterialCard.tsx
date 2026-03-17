import { Eye, FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { PublicMaterial } from "@/types";
import { MaterialTypeLabel } from "@/pages/rep/components/RepHelpers";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PublicMaterialCardProps {
  item: PublicMaterial;
  isActive: boolean;
  isOpening: boolean;
  onClick: (item: PublicMaterial) => void;
  onOpenNew: (item: PublicMaterial) => void;
}

export function PublicMaterialCard({
  item,
  isActive,
  isOpening,
  onClick,
  onOpenNew,
}: PublicMaterialCardProps) {
  return (
    <Card
      className={`group cursor-pointer overflow-hidden transition-all duration-300 ${
        isActive
          ? "ring-2 ring-primary bg-primary/5 shadow-lg shadow-primary/10"
          : "hover:border-primary/50 hover:shadow-md border-border/50 bg-background/50 backdrop-blur-sm"
      }`}
      onClick={() => onOpenNew(item)}
    >
      <div className="relative aspect-video bg-muted border-b border-border/10 overflow-hidden">
        {item.cover_path ? (
          <img
            src={`/api/v1/public/material/${item.id}/cover`}
            className="w-full aspect-video object-cover transition-transform duration-500 group-hover:scale-110"
            alt={item.title}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center opacity-20 transition-transform duration-500 group-hover:scale-110">
            <FileText className="h-10 w-10" />
            <span className="text-[8px] font-bold mt-2 uppercase tracking-widest">
              {item.type}
            </span>
          </div>
        )}
        
        <div className="absolute top-2.5 left-2.5 scale-90 origin-top-left">
          <MaterialTypeLabel type={item.type} />
        </div>

        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/60 to-transparent p-2.5 pt-6 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="sm"
            variant="secondary"
            className="h-8 w-full shadow-lg border-none hover:bg-white hover:text-black text-[11px]"
            loading={isOpening}
            onClick={(e) => {
              e.stopPropagation();
              onClick(item);
            }}
          >
            <Eye className="mr-1.5 h-3 w-3" /> Vista Previa
          </Button>
        </div>
      </div>
      <CardContent className="p-3">
        <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-1">
          Material #{item.id}
        </p>
        <Tooltip>
          <TooltipTrigger asChild>
            <h3 className={`text-sm font-semibold transition-colors line-clamp-2 leading-tight cursor-default ${
              isActive ? "text-primary" : "text-foreground group-hover:text-primary"
            }`}>
              {item.title}
            </h3>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="z-50">
            <p className="max-w-xs text-xs">{item.title}</p>
          </TooltipContent>
        </Tooltip>
        {item.description && (
          <p className="mt-1.5 text-[11px] text-muted-foreground line-clamp-1 leading-relaxed opacity-70">
            {item.description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
