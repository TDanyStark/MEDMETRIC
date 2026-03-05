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
        'group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-teal-600 text-white'
          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
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
    <aside className="flex h-full w-56 flex-col border-r border-slate-200 bg-white">
      {/* Logo */}
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-600">
          <span className="text-xs font-bold text-white">M</span>
        </div>
        <span className="text-sm font-semibold text-slate-900 tracking-tight">MedMetric</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {items.map(item => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-slate-100 px-3 py-3">
        <div className="flex items-center gap-2.5 rounded-md px-2 py-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
            {getInitials(user?.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-xs font-medium text-slate-900">{user?.name}</p>
            <p className="truncate text-xs text-slate-400 capitalize">{user?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="rounded p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
}
