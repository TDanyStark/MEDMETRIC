import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Building2, Users, LogOut, LayoutDashboard, LucideIcon, X } from 'lucide-react'
import { useEffect } from 'react'
import { useAuth } from '@/contexts/useAuth'
import { cn, getInitials } from '@/lib/utils'
import { Role } from '@/types'

interface NavItemData {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
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

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const items = user ? (NAV_ITEMS[user.role] ?? []) : []

  // Close mobile drawer when route changes.
  useEffect(() => {
    onClose()
  }, [location.pathname, onClose])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <>
      {/* Mobile backdrop */}
      <button
        type="button"
        aria-label="Cerrar menu"
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-40 bg-slate-900/40 transition-opacity md:hidden',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white shadow-sm transition-transform duration-300',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'md:static md:h-full md:translate-x-0',
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 shadow-sm">
              <span className="text-sm font-bold text-white">M</span>
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900">MedMetric</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700 md:hidden"
            title="Cerrar menu"
            aria-label="Cerrar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 px-4 py-6">
          {items.map(item => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-4">
          <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-bold text-teal-700">
              {getInitials(user?.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight text-slate-900">{user?.name}</p>
              <p className="mt-0.5 truncate text-xs font-medium capitalize text-slate-500">{user?.role}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="rounded-lg p-2 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
