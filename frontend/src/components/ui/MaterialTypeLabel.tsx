import { FileText, PlayCircle, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { MaterialType } from "@/types/rep";

export function MaterialTypeLabel({ type }: { type: MaterialType }) {
  const label = type === "pdf" ? "PDF" : type === "video" ? "Video" : "Link";
  const Icon =
    type === "pdf" ? FileText : type === "video" ? PlayCircle : ExternalLink;

  // Colores representativos con efecto glass (menos opaco)
  const styles = {
    pdf: "bg-blue-500/20 border-blue-500/30 text-blue-700 backdrop-blur-md shadow-sm",
    video:
      "bg-primary/10 border-primary/20 text-primary backdrop-blur-md shadow-sm",
    link: "bg-amber-500/20 border-amber-500/30 text-amber-700 backdrop-blur-md shadow-sm",
  };

  const currentStyle = styles[type] || styles.link;

  return (
    <Badge
      variant="outline"
      className={`gap-1.5 py-1 font-bold border ${currentStyle}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Badge>
  );
}
