import { FileText, Eye } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Material } from "@/types/rep";
import { MaterialTypeLabel } from "./RepHelpers";

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
      className={`group cursor-pointer overflow-hidden transition-all duration-300 ${
        isSelected
          ? "ring-2 ring-primary bg-primary/5"
          : "hover:border-primary/50 hover:shadow-md"
      }`}
      onClick={() => onToggle(item.id)}
    >
      <div className="relative aspect-5/4 bg-muted border-b border-border/10 overflow-hidden">
        {item.cover_path ? (
          <img
            src={`/api/v1/public/material/${item.id}/cover`}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
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
          className={`absolute top-3 right-3 h-5 w-5 rounded-full border flex items-center justify-center shadow-sm ${
            isSelected
              ? "bg-primary border-primary"
              : "bg-background/80 border-muted-foreground/30"
          }`}
        >
          {isSelected && <div className="h-2 w-2 rounded-full bg-background" />}
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/60 to-transparent p-3 pt-8 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="sm"
            variant="secondary"
            className="h-8 w-full shadow-lg border-none hover:bg-white hover:text-black"
            onClick={(e) => {
              e.stopPropagation();
              onPreview(item);
            }}
          >
            <Eye className="mr-1.5 h-3.5 w-3.5" /> Previsualización rápida
          </Button>
        </div>
      </div>
      <CardContent className="p-4 pt-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-1">
          Cód. {item.id}
        </p>
        <h3 className="font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
          {item.title}
        </h3>
        {item.description && (
          <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
