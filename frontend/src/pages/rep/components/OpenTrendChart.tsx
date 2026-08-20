import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";

import type { RepOpenTrendPoint } from "@/types/repMetrics";
import { parseUTCDate } from "@/lib/utils";

interface OpenTrendChartProps {
  data: RepOpenTrendPoint[] | undefined;
  isLoading: boolean;
}

interface ChartPoint extends RepOpenTrendPoint {
  label: string;
}

/**
 * Sesiones enviadas vs. abiertas por día. The backend already 0-fills every
 * org-local day in range (spec "Chart Data Correctness"), so this component
 * never needs to gap-fill — it only formats labels.
 *
 * `sessions_created` and `sessions_viewed` are rendered as TWO INDEPENDENT
 * lines with NO shared `stackId`. This mirrors the fix already applied to
 * `ViewsTrendChart` (backoffice), which originally stacked two series and
 * made one line visually overshoot its real value — replicate that fix
 * exactly, never regress it (spec "Chart Data Correctness").
 */
export function OpenTrendChart({ data, isLoading }: OpenTrendChartProps) {
  const points = useMemo<ChartPoint[]>(() => {
    if (!data) return [];
    return data.map((point) => ({
      ...point,
      label: parseUTCDate(point.date).toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "short",
      }),
    }));
  }, [data]);

  const hasActivity = points.some(
    (p) => p.sessions_created > 0 || p.sessions_viewed > 0,
  );

  return (
    <div className="rounded-3xl border border-border/50 bg-background/50 p-6 shadow-sm">
      <div className="mb-6 flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-display text-xl font-medium">
          Enviadas vs. abiertas
        </h3>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          Cargando…
        </div>
      ) : points.length === 0 || !hasActivity ? (
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          Sin actividad en este rango de fechas
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                domain={[0, "dataMax"]}
                width={32}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  fontSize: "0.8125rem",
                }}
                labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
                formatter={(value, name) => [
                  value ?? 0,
                  name === "sessions_created" ? "Enviadas" : "Abiertas",
                ]}
              />
              {/*
                Two INDEPENDENT lines, no stackId — each renders exactly at
                its own value, never a cumulative height. See docblock above.
              */}
              <Line
                type="monotone"
                dataKey="sessions_created"
                name="sessions_created"
                stroke="#8b5cf6"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={{ r: 3, strokeWidth: 0, fill: "#8b5cf6" }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--background)" }}
              />
              <Line
                type="monotone"
                dataKey="sessions_viewed"
                name="sessions_viewed"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 0, fill: "#10b981" }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--background)" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-4 flex items-center gap-5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#8b5cf6]" /> Enviadas
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#10b981]" /> Abiertas
        </span>
      </div>
    </div>
  );
}
