import { NavLink, useNavigate } from 'react-router-dom'
import { Building2, Users, LogOut, LayoutDashboard, LucideIcon } from 'lucide-react'
import { useAuth } from '@/contexts/useAuth'
import { cn, getInitials } from '@/lib/utils'
import { Role } from '@/types'

interface NavItemData {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const NAV_ITEMS: Record<Role, NavItemData[]> = {
  admin: [
    { to: '/admin',              label: 'Dashboard',      icon: LayoutDashboard, end: true },
    { to: '/admin/organizations', label: 'Organizaciones', icon: Building2 },
    { to: '/admin/users',         label: 'Usuarios',       icon: Users },
  ],
  manager: [],
  rep: [],
}

function NavItem({ to, label, icon: Icon, end }: NavItemData) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => cn(
        'group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all',
        isActive
          ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/80',
      )}
    >
      <Icon className={cn("h-5 w-5 shrink-0 transition-colors", "group-hover:text-slate-900")} />
      <span>{label}</span>
    </NavLink>
  )
}

export function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const items = user ? (NAV_ITEMS[user.role] ?? []) : []

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className="flex h-full w-64 flex-col border-r border-slate-200 bg-white shadow-sm">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 shadow-sm">
          <span className="text-sm font-bold text-white">M</span>
        </div>
        <span className="text-lg font-bold text-slate-900 tracking-tight">MedMetric</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {items.map(item => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-slate-100 px-4 py-4 bg-slate-50/50">
        <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-bold text-teal-700">
            {getInitials(user?.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900 leading-tight">{user?.name}</p>
            <p className="truncate text-xs text-slate-500 font-medium capitalize mt-0.5">{user?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="rounded-lg p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
