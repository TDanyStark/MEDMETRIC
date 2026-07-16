import { ExternalLink, FileText } from "lucide-react";
import { MaterialStudy } from "@/types/backoffice";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RepStudyListItemProps {
  study: MaterialStudy;
  onClick: () => void;
}

/**
 * Read-only, clickable row for a single study inside the rep's material
 * preview dialog. No edit/delete affordances — reps only ever read studies.
 */
export function RepStudyListItem({ study, onClick }: RepStudyListItemProps) {
  const Icon = study.type === "pdf" ? FileText : ExternalLink;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-xl border border-border/40 bg-background/60 px-3 py-2 text-left text-sm transition-colors hover:border-primary/30 hover:bg-primary/5"
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="line-clamp-2 font-medium leading-snug text-foreground">
            {study.title}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-xs">{study.title}</p>
        </TooltipContent>
      </Tooltip>
    </button>
  );
}
