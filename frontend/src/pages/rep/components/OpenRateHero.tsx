import { RadialBar, RadialBarChart, PolarAngleAxis } from "recharts";
import { Clock3, FileCheck2, FileX2, UserX } from "lucide-react";

import type { RepMetricsSummary } from "@/types/repMetrics";

interface OpenRateHeroProps {
  summary: RepMetricsSummary | undefined;
  isLoading: boolean;
}

/**
 * The "open-pulse" — signature element of the rep metrics module. This is
 * the FIRST thing the rep sees and answers the one question they ask every
 * day: "¿el médico vio lo que le mandé?". Everything else on the page
 * supports this ring, never competes with it (interface-design "signature").
 *
 * The ring itself is deliberately compact (128px) and thin (barSize 8) so
 * the % NUMBER stays the dominant element, not the ring — a wider/thicker
 * ring at this content density made the percentage hard to read at a
 * glance (post-review fix).
 *
 * Stat chips below use the SAME neutral card surface for all four metrics
 * (`border-border/60 bg-background`, matching the branding tokens defined
 * in `index.css` / `@theme inline`), with a small icon-badge carrying the
 * only color — the org_admin `MetricsDashboard` summary cards use this
 * exact "neutral card + colored icon-badge" pattern
 * (`bg-{color}-500/10 text-{color}-500` circle), so this reuses an
 * established convention instead of inventing a new pastel-card style.
 * Colors on the icon badges reuse the SAME semantic language already
 * established by `SessionViewBadge` (emerald = vista, amber = no vista) so
 * the rep never has to relearn what a color means between the history
 * table and this dashboard — only the PRESENTATION (full pastel card vs.
 * small icon badge) changed, not the semantic pairing itself.
 */
export function OpenRateHero({ summary, isLoading }: OpenRateHeroProps) {
  const hasSessions = (summary?.sessions_total ?? 0) > 0;
  const percent = summary && hasSessions ? Math.round(summary.open_rate * 100) : 0;
  const ringData = [{ value: percent, fill: "#10b981" }];

  return (
    <div className="rounded-3xl border border-border/50 bg-background/50 p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-8 sm:flex-row sm:items-center">
        <div className="relative mx-auto h-32 w-32 shrink-0 sm:mx-0">
          <RadialBarChart
            width={128}
            height={128}
            cx="50%"
            cy="50%"
            innerRadius="78%"
            outerRadius="100%"
            barSize={8}
            data={ringData}
            startAngle={90}
            endAngle={-270}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
            <RadialBar
              dataKey="value"
              background={{ fill: "var(--muted)" }}
              cornerRadius={20}
              isAnimationActive={!isLoading}
            />
          </RadialBarChart>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-3xl font-semibold tabular-nums text-foreground">
              {isLoading ? "—" : `${percent}%`}
            </span>
            <span className="mt-0.5 text-center text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Apertura
            </span>
          </div>
        </div>

        <div className="flex-1">
          <h2 className="font-display text-xl font-medium text-foreground sm:text-2xl">
            ¿El médico vio lo que le mandaste?
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {isLoading ? (
              "Calculando…"
            ) : !hasSessions ? (
              "Aún no tienes sesiones en este rango de fechas."
            ) : (
              <>
                <span className="font-semibold text-foreground">
                  {summary?.sessions_viewed}
                </span>{" "}
                de{" "}
                <span className="font-semibold text-foreground">
                  {summary?.sessions_total}
                </span>{" "}
                sesiones fueron vistas por el médico
              </>
            )}
          </p>

          {hasSessions && (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="flex flex-col gap-1.5 rounded-2xl border border-border/60 bg-background px-3 py-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
                  <UserX className="h-4 w-4" />
                </div>
                <span className="font-display text-lg font-semibold tabular-nums text-foreground">
                  {summary?.doctors_never_opened ?? 0}
                </span>
                <span className="text-[0.68rem] leading-tight text-muted-foreground">
                  médicos sin abrir
                </span>
              </div>

              <div className="flex flex-col gap-1.5 rounded-2xl border border-border/60 bg-background px-3 py-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Clock3 className="h-4 w-4" />
                </div>
                <span className="font-display text-lg font-semibold tabular-nums text-foreground">
                  {summary?.first_open_median_hours != null
                    ? `${summary.first_open_median_hours}h`
                    : "—"}
                </span>
                <span className="text-[0.68rem] leading-tight text-muted-foreground">
                  demora hasta 1ª apertura
                </span>
              </div>

              <div className="flex flex-col gap-1.5 rounded-2xl border border-border/60 bg-background px-3 py-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                  <FileCheck2 className="h-4 w-4" />
                </div>
                <span className="font-display text-lg font-semibold tabular-nums text-foreground">
                  {summary?.materials_opened ?? 0}
                </span>
                <span className="text-[0.68rem] leading-tight text-muted-foreground">
                  materiales abiertos
                </span>
              </div>

              <div className="flex flex-col gap-1.5 rounded-2xl border border-border/60 bg-background px-3 py-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <FileX2 className="h-4 w-4" />
                </div>
                <span className="font-display text-lg font-semibold tabular-nums text-foreground">
                  {summary?.materials_unopened ?? 0}
                </span>
                <span className="text-[0.68rem] leading-tight text-muted-foreground">
                  materiales sin abrir
                </span>
              </div>
            </div>
          )}

          {hasSessions && (
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Unidad: materiales enviados (pares sesión-material). Filtra por la
              fecha de envío de la sesión — el estado abierto/sin abrir no
              depende del rango de fechas.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
