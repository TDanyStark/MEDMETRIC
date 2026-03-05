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

function NavItem({ to, label, description, icon: Icon }: ReturnType<typeof getNavItems>[number]) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => cn(
        'group flex items-start gap-3 rounded-3xl border px-4 py-3.5 transition-all',
        isActive
          ? 'border-primary/20 bg-primary text-primary-foreground shadow-[0_18px_40px_rgba(24,90,86,0.22)]'
          : 'border-transparent bg-transparent text-muted-foreground hover:border-border/80 hover:bg-card/85 hover:text-foreground',
      )}
    >
      {({ isActive }) => (
        <>
          <div className={cn(
            'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition-colors',
            isActive
              ? 'border-white/15 bg-white/10 text-primary-foreground'
              : 'border-border/80 bg-background/70 text-foreground',
          )}>
            <Icon className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-none">{label}</p>
            <p className={cn('mt-1 text-xs leading-5', isActive ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
              {description}
            </p>
          </div>
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
    <div className="flex h-full flex-col bg-sidebar/90 px-4 py-4 backdrop-blur">
      <div className="rounded-[28px] border border-border/80 bg-card/90 p-5 shadow-[0_18px_60px_rgba(16,41,39,0.08)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-[1.35rem] leading-none tracking-tight text-foreground">MedMetric</p>
            <p className="mt-2 text-xs uppercase tracking-[0.28em] text-muted-foreground">Medical briefing system</p>
          </div>
          <div className="rounded-2xl border border-primary/20 bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
            Fase 8
          </div>
        </div>

        {blueprint && (
          <div className="mt-5 rounded-3xl border border-border/80 bg-background/85 p-4">
            <p className="text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground">{blueprint.eyebrow}</p>
            <h2 className="mt-2 font-display text-xl text-foreground">{blueprint.label}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{blueprint.deck}</p>
          </div>
        )}
      </div>

      <div className="mt-4 rounded-[28px] border border-border/80 bg-card/85 p-3 shadow-[0_18px_60px_rgba(16,41,39,0.08)]">
        <div className="mb-2 flex items-center justify-between px-2 py-2">
          <div>
            <p className="text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground">Navegacion</p>
            <p className="mt-1 text-sm font-medium text-foreground">{activeItem?.label ?? 'Modulo'}</p>
          </div>
          <Badge variant="outline">Base lista</Badge>
        </div>
        <nav className="space-y-2">
          {items.map(item => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>
      </div>

      <div className="mt-auto rounded-[28px] border border-border/80 bg-card/90 p-4 shadow-[0_18px_60px_rgba(16,41,39,0.08)]">
        <div className="flex items-center gap-3 rounded-[22px] border border-border/70 bg-background/75 p-3">
          <Avatar className="h-11 w-11 border border-border/70 bg-primary/10 text-primary">
            <AvatarFallback>{getInitials(user?.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{user?.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-background/75 text-muted-foreground transition hover:border-primary/30 hover:bg-primary hover:text-primary-foreground"
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
      <aside className="hidden h-screen w-88 shrink-0 border-r border-border/60 bg-sidebar/55 md:block">
        {content}
      </aside>

      <Sheet open={isOpen} onOpenChange={open => (!open ? onClose() : undefined)}>
        <SheetContent side="left" className="w-88 border-r border-border/60 bg-sidebar p-0">
          <div className="flex items-center justify-end border-b border-border/70 px-4 py-3">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-background/80 text-muted-foreground transition hover:text-foreground"
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
