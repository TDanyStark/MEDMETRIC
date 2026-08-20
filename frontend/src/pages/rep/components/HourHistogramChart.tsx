import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Clock } from "lucide-react";

import type { RepHourBucket } from "@/types/repMetrics";

interface HourHistogramChartProps {
  data: RepHourBucket[] | undefined;
  isLoading: boolean;
}

/**
 * Hora del día (org-local) en que el médico abre materiales. The backend
 * always returns exactly 24 entries (0-23), 0-filled — missing hours read
 * as "sin actividad", never as a broken/gapped axis (spec "Chart Data
 * Correctness"). Single series, no stacking involved.
 */
export function HourHistogramChart({ data, isLoading }: HourHistogramChartProps) {
  const points = useMemo(() => {
    if (!data) return [];
    return data.map((bucket) => ({
      ...bucket,
      label: `${String(bucket.hour).padStart(2, "0")}h`,
    }));
  }, [data]);

  const hasActivity = points.some((p) => p.opens > 0);

  return (
    <div className="rounded-3xl border border-border/50 bg-background/50 p-6 shadow-sm">
      <div className="mb-6 flex items-center gap-2">
        <Clock className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-display text-xl font-medium">Hora del día</h3>
      </div>

      {isLoading ? (
        <div className="flex h-56 items-center justify-center text-muted-foreground">
          Cargando…
        </div>
      ) : !hasActivity ? (
        <div className="flex h-56 items-center justify-center text-muted-foreground">
          Sin aperturas registradas aún
        </div>
      ) : (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={points} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                interval={2}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                domain={[0, "dataMax"]}
                width={28}
              />
              <Tooltip
                cursor={{ fill: "var(--accent)", opacity: 0.4 }}
                contentStyle={{
                  backgroundColor: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  fontSize: "0.8125rem",
                }}
                labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
                formatter={(value) => [value ?? 0, "Aperturas"]}
              />
              <Bar dataKey="opens" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
