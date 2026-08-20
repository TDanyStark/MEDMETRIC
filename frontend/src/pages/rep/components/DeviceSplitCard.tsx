import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Monitor, Smartphone } from "lucide-react";

import type { RepDeviceSplit } from "@/types/repMetrics";

interface DeviceSplitCardProps {
  data: RepDeviceSplit | undefined;
  isLoading: boolean;
}

const COLORS = { mobile: "#8b5cf6", desktop: "#0ea5e9" };

/**
 * Móvil vs. desktop, derivado server-side desde
 * `App\Infrastructure\Support\DeviceClassifier` — nunca se recibe ni se
 * muestra el `user_agent` crudo (spec "Doctor Privacy"). Part-of-whole
 * relationship, so a donut reads more naturally than a bar/line here.
 *
 * No hover `<Tooltip>` on purpose (post-review fix): a floating recharts
 * tooltip was covering the center % on hover. Instead BOTH percentages are
 * rendered as static, always-visible text — the center % (headline) and a
 * per-row % next to each device's raw count — so the rep can read them
 * with or without hovering, never only on hover.
 */
export function DeviceSplitCard({ data, isLoading }: DeviceSplitCardProps) {
  const total = (data?.mobile ?? 0) + (data?.desktop ?? 0);

  const points = useMemo(() => {
    if (!data) return [];
    return [
      { key: "mobile", label: "Móvil", value: data.mobile, fill: COLORS.mobile },
      { key: "desktop", label: "Desktop", value: data.desktop, fill: COLORS.desktop },
    ];
  }, [data]);

  const mobilePercent = total > 0 ? Math.round(((data?.mobile ?? 0) / total) * 100) : 0;
  const desktopPercent = total > 0 ? 100 - mobilePercent : 0;

  return (
    <div className="rounded-3xl border border-border/50 bg-background/50 p-6 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <Smartphone className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-display text-xl font-medium">Móvil vs. Desktop</h3>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Unidad: veces abierto, no médicos. Incluye materiales ya
        desadjuntados de la sesión y filtra por fecha de apertura. Las
        tablets cuentan como móvil.
      </p>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center text-muted-foreground">
          Cargando…
        </div>
      ) : total === 0 ? (
        <div className="flex h-48 items-center justify-center text-muted-foreground">
          Sin aperturas registradas aún
        </div>
      ) : (
        <div className="flex items-center gap-6">
          <div className="relative h-40 w-40 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={points}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={48}
                  outerRadius={70}
                  paddingAngle={total > 0 && points.every((p) => p.value > 0) ? 3 : 0}
                  strokeWidth={0}
                >
                  {points.map((point) => (
                    <Cell key={point.key} fill={point.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-2xl font-semibold text-foreground">
                {mobilePercent}%
              </span>
              <span className="text-[0.62rem] uppercase tracking-wider text-muted-foreground">
                móvil
              </span>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-3">
            <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background px-3.5 py-2.5">
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Smartphone className="h-4 w-4" style={{ color: COLORS.mobile }} /> Móvil
              </span>
              <span className="flex items-baseline gap-1.5">
                <span className="font-display text-lg font-semibold tabular-nums text-foreground">
                  {data?.mobile ?? 0}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  ({mobilePercent}%)
                </span>
              </span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background px-3.5 py-2.5">
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Monitor className="h-4 w-4" style={{ color: COLORS.desktop }} /> Desktop
              </span>
              <span className="flex items-baseline gap-1.5">
                <span className="font-display text-lg font-semibold tabular-nums text-foreground">
                  {data?.desktop ?? 0}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  ({desktopPercent}%)
                </span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
