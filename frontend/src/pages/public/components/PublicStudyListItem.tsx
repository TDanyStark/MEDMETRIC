import { ExternalLink, FileText } from "lucide-react";
import { PublicStudy } from "@/types";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PublicStudyListItemProps {
  study: PublicStudy;
  href: string;
}

/**
 * A single nested "estudio médico" link rendered under a public material
 * card. Opens the study resource directly (same session-token/viewer_type
 * mechanism as the parent material link), independent of the card's own
 * link so a click here never triggers the material's href.
 *
 * The title clamps to a max of 2 lines; a tooltip surfaces the full title
 * on hover in case it was truncated.
 */
export function PublicStudyListItem({ study, href }: PublicStudyListItemProps) {
  const Icon = study.type === "pdf" ? FileText : ExternalLink;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="flex items-start gap-2 rounded-lg border border-border/40 bg-background/60 px-2.5 py-1.5 text-xs text-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
        >
          <Icon className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
          <span className="line-clamp-2 leading-snug">{study.title}</span>
        </a>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="z-50">
        <p className="max-w-xs text-xs">{study.title}</p>
      </TooltipContent>
    </Tooltip>
  );
}
