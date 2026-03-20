import { FileText, Share2 } from "lucide-react";
import { toast } from "sonner";
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
  href: string;
  showShare?: boolean;
  shareUrl?: string;
}

export function PublicMaterialCard({
  item,
  isActive,
  href,
  showShare = false,
  shareUrl,
}: PublicMaterialCardProps) {
  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!shareUrl) return;

    navigator.clipboard.writeText(shareUrl)
      .then(() => toast.success("Enlace para el médico copiado con éxito"))
      .catch(() => toast.error("No se pudo copiar el enlace"));
  };

  return (
    <div className="relative isolate">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block group"
      >
        <Card
          className={`cursor-pointer overflow-hidden transition-all duration-300 ${
            isActive
              ? "ring-2 ring-primary bg-primary/5 shadow-lg shadow-primary/10"
              : "hover:border-primary/50 hover:shadow-md border-border/50 bg-background/50 backdrop-blur-sm"
          }`}
        >
          <div className="relative aspect-video bg-muted border-b border-border/10 overflow-hidden">
            {item.cover_url || item.cover_path ? (
              <img
                src={item.cover_url || `/api/v1/public/material/${item.id}/cover`}
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
              <p className="mt-1.5 text-[10px] text-muted-foreground line-clamp-2 leading-[1.3] opacity-80 min-h-[2rem]">
                {item.description}
              </p>
            )}
          </CardContent>
        </Card>
      </a>

      {showShare && shareUrl && (
        <div className="absolute top-2.5 right-2.5 z-20">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 rounded-full p-0 shadow-xl bg-background/90 border-border/30 hover:bg-primary hover:text-white transition-all duration-300"
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
  );
}
