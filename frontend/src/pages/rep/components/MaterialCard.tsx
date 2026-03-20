import { FileText, Eye } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
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
  return (
    <Card
      className={`group cursor-pointer overflow-hidden transition-all duration-300 h-full flex flex-col ${
        isSelected
          ? "ring-2 ring-primary bg-primary/5 shadow-md"
          : "hover:border-primary/50 hover:shadow-lg border-border/40 bg-background/50 backdrop-blur-sm"
      }`}
      onClick={() => onToggle(item.id)}
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
        <div
          className={`absolute top-3 right-3 h-5 w-5 rounded-full border flex items-center justify-center shadow-sm transition-all duration-300 ${
            isSelected
              ? "bg-primary border-primary scale-110"
              : "bg-background/80 border-muted-foreground/30 scale-100"
          }`}
        >
          {isSelected && <div className="h-2 w-2 rounded-full bg-background" />}
        </div>

        {/* Action Overlay */}
        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/40 to-transparent p-3 pt-10 flex justify-center lg:opacity-0 lg:group-hover:opacity-100 transition-all duration-300">
          <Button
            size="sm"
            variant="secondary"
            className="h-8 w-full shadow-lg border-none font-semibold text-[11px] hover:bg-white hover:text-black transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onPreview(item);
            }}
          >
            <Eye className="mr-1.5 h-3.5 w-3.5" /> Previsualización rápida
          </Button>
        </div>
      </div>
      <CardContent className="p-4 pt-3 flex-1 flex flex-col">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-2">
          <span>MAT-{item.id}</span>
          <span>{formatDate(item.created_at)}</span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <h3 className="font-bold text-foreground line-clamp-2 group-hover:text-primary transition-colors cursor-default leading-tight min-h-[2.5rem]">
              {item.title}
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
      </CardContent>
    </Card>
  );
}
