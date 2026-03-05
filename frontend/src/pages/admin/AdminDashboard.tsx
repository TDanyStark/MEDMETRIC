import { Building2, Users, UserCheck, Briefcase, LucideIcon } from 'lucide-react'
import { useOrganizations } from '@/hooks/useOrganizations'
import { useAdminUsers } from '@/hooks/useAdminUsers'
import { Link } from 'react-router-dom'
import { formatDateTime } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { User } from '@/types'

const ROLE_LABEL: Record<string, string> = { admin: 'Administrador', manager: 'Gerente', rep: 'Visitador' }
const ROLE_BADGE: Record<string, any> = { admin: 'admin', manager: 'manager', rep: 'rep' }

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value?: number;
  to: string;
  color?: 'teal' | 'blue' | 'amber' | 'violet';
}

function StatCard({ icon: Icon, label, value, to, color = 'teal' }: StatCardProps) {
  const colorMap = {
    teal:   { bg: 'bg-teal-50',   text: 'text-teal-600'   },
    blue:   { bg: 'bg-blue-50',   text: 'text-blue-600'   },
    amber:  { bg: 'bg-amber-50',  text: 'text-amber-600'  },
    violet: { bg: 'bg-violet-50', text: 'text-violet-600' },
  }
  const c = colorMap[color] ?? colorMap.teal

  return (
    <Link to={to} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 hover:border-slate-300 transition-colors shadow-sm group">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${c.bg} ${c.text}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-semibold text-slate-900 leading-none">{value !== undefined ? value : '—'}</p>
        <p className="text-xs text-slate-500 mt-1">{label}</p>
      </div>
    </Link>
  )
}

export default function AdminDashboard() {
  const { data: orgsResult } = useOrganizations()
  const { data: usersResult } = useAdminUsers()

  const orgsTotal  = orgsResult?.total
  const usersTotal = usersResult?.total
  
  // Note: These counts are only for the current page (max 20)
  // For a real dashboard we might want a specific metrics endpoint (Phase 10)
  // But for now we show the totals from the first page metadata
  const items = usersResult?.items ?? []
  
  const recentUsers = [...items].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  ).slice(0, 5)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-base font-semibold text-slate-900">Panel de administración</h1>
        <p className="text-xs text-slate-500 mt-0.5">Vista general del sistema</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-8 sm:grid-cols-4">
        <StatCard icon={Building2} label="Organizaciones" value={orgsTotal}  to="/admin/organizations" color="teal"   />
        <StatCard icon={Users}     label="Total usuarios"  value={usersTotal} to="/admin/users"         color="blue"   />
        
        {/* These specific role counts aren't in metadata yet, showing first-page only for now */}
        <StatCard icon={Briefcase} label="Gerentes (p.1)"  value={items.filter(u => u.role === 'manager').length}   to="/admin/users?role=manager" color="violet" />
        <StatCard icon={UserCheck} label="Visitadores (p.1)" value={items.filter(u => u.role === 'rep').length}       to="/admin/users?role=rep"     color="amber"  />
      </div>

      {/* Recent users */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-sm font-medium text-slate-900">Usuarios recientes (página 1)</h2>
        </div>
        {recentUsers.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">Sin usuarios aún.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recentUsers.map((u: User) => (
              <li key={u.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/60 transition-colors">
                <div>
                  <p className="text-sm font-medium text-slate-900">{u.name}</p>
                  <p className="text-xs text-slate-400">{u.email} · {u.organization_name}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">{formatDateTime(u.created_at)}</span>
                  <Badge variant={ROLE_BADGE[u.role]}>{ROLE_LABEL[u.role] ?? u.role}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
