import { useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, PanelLeftClose } from 'lucide-react'
import { useAuth } from '@/contexts/useAuth'
import { Avatar, AvatarFallback } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Sheet, SheetContent } from '@/components/ui/Sheet'
import { getNavItem, getNavItems, ROLE_BLUEPRINTS } from '@/lib/auth'
import { cn, getInitials } from '@/lib/utils'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

function NavItem({ to, label, icon: Icon }: ReturnType<typeof getNavItems>[number]) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => cn(
        'group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all',
        isActive
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
      )}
    >
      {({ isActive }) => (
        <>
          <Icon className={cn("h-5 w-5 shrink-0 transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
          <p className="text-sm leading-none">{label}</p>
        </>
      )}
    </NavLink>
  )
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const items = user ? getNavItems(user.role) : []
  const activeItem = user ? getNavItem(user.role, location.pathname) : null
  const blueprint = user ? ROLE_BLUEPRINTS[user.role] : null

  useEffect(() => {
    onClose()
  }, [location.pathname, onClose])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const content = (
    <div className="flex h-full flex-col bg-sidebar px-4 py-4">
      <div className="rounded-[28px] border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-[1.35rem] leading-none tracking-tight text-foreground">MedMetric</p>
            <p className="mt-2 text-xs uppercase tracking-[0.28em] text-muted-foreground">Medical briefing system</p>
          </div>
        </div>

        {blueprint && (
          <div className="mt-5 rounded-3xl border border-border bg-background p-4">
            <p className="text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground">{blueprint.eyebrow}</p>
            <h2 className="mt-2 font-display text-xl text-foreground">{blueprint.label}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{blueprint.deck}</p>
          </div>
        )}
      </div>

      <div className="mt-4 rounded-[28px] border border-border bg-card p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between px-2 py-2">
          <div>
            <p className="text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground">Navegacion</p>
            <p className="mt-1 text-sm font-medium text-foreground">{activeItem?.label ?? 'Modulo'}</p>
          </div>
          <Badge variant="accent">Operacion</Badge>
        </div>
        <nav className="space-y-2">
          {items.map(item => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>
      </div>

      <div className="mt-auto rounded-[28px] border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3 rounded-[22px] border border-border bg-background p-3">
          <Avatar className="h-11 w-11 border border-border bg-primary/10 text-primary">
            <AvatarFallback>{getInitials(user?.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{user?.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-background text-muted-foreground transition hover:border-primary/30 hover:bg-primary hover:text-primary-foreground"
            title="Cerrar sesion"
            aria-label="Cerrar sesion"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <aside className="hidden h-screen w-88 shrink-0 border-r border-border bg-sidebar md:block">
        {content}
      </aside>

      <Sheet open={isOpen} onOpenChange={open => (!open ? onClose() : undefined)}>
        <SheetContent side="left" className="w-88 border-r border-border bg-sidebar p-0">
          <div className="flex items-center justify-end border-b border-border px-4 py-3">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-background text-muted-foreground transition hover:text-foreground"
              aria-label="Cerrar menu"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>
          {content}
        </SheetContent>
      </Sheet>
    </>
  )
}
