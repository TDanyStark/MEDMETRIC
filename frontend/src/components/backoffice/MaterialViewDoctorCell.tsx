import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DoctorLinkStatus } from "@/services/metrics";

interface MaterialViewDoctorCellProps {
  doctorName: string | null;
  doctorLinkStatus: DoctorLinkStatus;
}

/**
 * Renders the "médico de la visita" cell in the material views log.
 *
 * This is intentionally a separate concept from the "Visualizador" column
 * (who actually opened the material — rep or doctor): a representative can
 * view a material during a visit tied to a specific doctor, and this column
 * always answers "whose visit is this", never "who clicked".
 *
 * Three states, so a missing doctor is never an ambiguous blank cell:
 * - linked   -> canonical name resolved via visit_sessions.doctor_id against
 *               the doctors catalog (normal case, always up to date).
 * - legacy   -> only a historical text snapshot exists — the session
 *               predates the doctor_id link, so identity can't be confirmed
 *               against the catalog (some organizations have duplicate
 *               doctor names, so text alone is ambiguous).
 * - no_visit -> the view has no associated visit session at all (e.g. a rep
 *               opened the material outside of any visit) — there is
 *               genuinely no doctor to show, not a missing value.
 */
export function MaterialViewDoctorCell({
  doctorName,
  doctorLinkStatus,
}: MaterialViewDoctorCellProps) {
  if (doctorLinkStatus === "no_visit") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 text-muted-foreground/70 italic cursor-default">
            <Info className="h-3 w-3 shrink-0" />
            Sin visita asociada
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">
            Este visualizador abrió el material fuera de una sesión de
            visita, por lo que no hay ningún médico asociado a este
            registro.
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (doctorLinkStatus === "legacy") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 align-middle cursor-default">
            <Info className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="truncate max-w-[170px]">{doctorName}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">
            {doctorName} — dato histórico de una visita previa al enlace con
            la ficha de médico, sin confirmar contra el catálogo (puede
            haber nombres duplicados en la organización).
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-block align-middle truncate max-w-[200px] cursor-default">
          {doctorName}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p className="max-w-xs">{doctorName}</p>
      </TooltipContent>
    </Tooltip>
  );
}
