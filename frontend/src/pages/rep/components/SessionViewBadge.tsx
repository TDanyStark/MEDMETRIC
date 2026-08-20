import { Eye, EyeOff } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/utils";

interface SessionViewBadgeProps {
  viewed: boolean;
  openCount: number;
  lastOpenAt: string | null;
  timezone?: string | null;
}

/**
 * Glanceable "did the doctor open this?" indicator for the rep's session
 * history (sdd/rep-metrics-module Phase 3). This is the single most-asked
 * daily question for a field rep, so it must read at a glance with zero
 * extra clicks — never render an ambiguous bare "0".
 */
export function SessionViewBadge({
  viewed,
  openCount,
  lastOpenAt,
  timezone,
}: SessionViewBadgeProps) {
  if (!viewed) {
    return (
      <Badge variant="warm" className="w-fit gap-1.5 normal-case tracking-normal">
        <EyeOff className="h-3 w-3" /> No vista
      </Badge>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Badge variant="success" className="w-fit gap-1.5 normal-case tracking-normal">
        <Eye className="h-3 w-3" /> Vista
      </Badge>
      <p className="text-xs text-muted-foreground">
        {openCount} {openCount === 1 ? "apertura" : "aperturas"}
        {lastOpenAt && (
          <> · última {formatDateTime(lastOpenAt, timezone)}</>
        )}
      </p>
    </div>
  );
}
