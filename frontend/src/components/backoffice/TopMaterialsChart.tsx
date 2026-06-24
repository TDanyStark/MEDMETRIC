import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BarChart3 } from 'lucide-react'
import type { TopMaterialMetric } from '@/services/metrics'

interface TopMaterialsChartProps {
  data: TopMaterialMetric[] | undefined
  isLoading: boolean
}

interface ChartPoint {
  name: string
  fullName: string
  rep: number
  doctor: number
}

function truncate(value: string, max = 28): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

export function TopMaterialsChart({ data, isLoading }: TopMaterialsChartProps) {
  const points = useMemo<ChartPoint[]>(() => {
    if (!data) return []
    return data
      .filter((m) => Number(m.total_views) > 0)
      .slice(0, 8)
      .map((m) => ({
        name: truncate(m.title),
        fullName: m.title,
        rep: Number(m.rep_views) || 0,
        doctor: Number(m.doctor_views) || 0,
      }))
  }, [data])

  return (
    <div className="rounded-3xl border border-border/50 bg-background/50 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-xl font-display font-medium">
          Materiales por visualizaciones
        </h3>
      </div>

      {isLoading ? (
        <div className="h-80 flex items-center justify-center text-muted-foreground">
          Cargando...
        </div>
      ) : points.length === 0 ? (
        <div className="h-80 flex items-center justify-center text-muted-foreground">
          No hay datos de visualizaciones aún
        </div>
      ) : (
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={points}
              layout="vertical"
              margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
              barCategoryGap={12}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                horizontal={false}
              />
              <XAxis
                type="number"
                tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={150}
                tick={{ fontSize: 12, fill: 'var(--foreground)' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: 'var(--accent)', opacity: 0.4 }}
                contentStyle={{
                  backgroundColor: 'var(--popover)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  fontSize: '0.8125rem',
                }}
                labelStyle={{ color: 'var(--foreground)', fontWeight: 600 }}
                formatter={(value: number, name: string) => [
                  value,
                  name === 'rep' ? 'Visitadores' : 'Médicos',
                ]}
                labelFormatter={(_label, payload) =>
                  payload?.[0]?.payload?.fullName ?? _label
                }
              />
              <Bar
                dataKey="rep"
                stackId="v"
                fill="#8b5cf6"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="doctor"
                stackId="v"
                fill="#14b8a6"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
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
