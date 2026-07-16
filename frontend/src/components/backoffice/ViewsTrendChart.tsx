import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { LineChart as LineChartIcon } from 'lucide-react'
import type { MaterialViewsMetric } from '@/services/metrics'
import { parseUTCDate } from '@/lib/utils'

interface ViewsTrendChartProps {
  data: MaterialViewsMetric[] | undefined
  isLoading: boolean
}

interface ChartPoint {
  date: string
  label: string
  rep: number
  doctor: number
  total: number
}

export function ViewsTrendChart({ data, isLoading }: ViewsTrendChartProps) {
  const points = useMemo<ChartPoint[]>(() => {
    if (!data || data.length === 0) return []

    const byDate = new Map<string, ChartPoint>()
    for (const row of data) {
      const key = row.date
      const existing =
        byDate.get(key) ??
        ({ date: key, label: '', rep: 0, doctor: 0, total: 0 } as ChartPoint)
      const views = Number(row.views) || 0
      if (row.viewer_type === 'rep') existing.rep += views
      else existing.doctor += views
      existing.total = existing.rep + existing.doctor
      byDate.set(key, existing)
    }

    return Array.from(byDate.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((p) => ({
        ...p,
        label: parseUTCDate(p.date).toLocaleDateString('es-MX', {
          day: '2-digit',
          month: 'short',
        }),
      }))
  }, [data])

  return (
    <div className="rounded-3xl border border-border/50 bg-background/50 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <LineChartIcon className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-xl font-display font-medium">
          Tendencia de visualizaciones
        </h3>
      </div>

      {isLoading ? (
        <div className="h-72 flex items-center justify-center text-muted-foreground">
          Cargando...
        </div>
      ) : points.length === 0 ? (
        <div className="h-72 flex items-center justify-center text-muted-foreground">
          No hay datos de visualizaciones aún
        </div>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={points}
              margin={{ top: 10, right: 12, left: -16, bottom: 0 }}
            >
              <defs>
                <linearGradient id="fillRep" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fillDoctor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
              <YAxis
                tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--popover)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  fontSize: '0.8125rem',
                }}
                labelStyle={{ color: 'var(--foreground)', fontWeight: 600 }}
                formatter={(value, name) => [
                  value ?? 0,
                  name === 'rep' ? 'Visitadores' : 'Médicos',
                ]}
              />
              <Area
                type="monotone"
                dataKey="doctor"
                stackId="1"
                stroke="#14b8a6"
                fill="url(#fillDoctor)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="rep"
                stackId="1"
                stroke="#8b5cf6"
                fill="url(#fillRep)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-4 flex items-center gap-5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#8b5cf6]" /> Visitadores
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#14b8a6]" /> Médicos
        </span>
      </div>
    </div>
  )
}
