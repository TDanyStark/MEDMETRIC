import { useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, LineChart } from 'lucide-react'
import { useAuth } from '@/contexts/useAuth'
import { Sheet, SheetContent } from '@/components/ui/Sheet'
import { getNavItems } from '@/lib/auth'
import { cn } from '@/lib/utils'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

function NavItem({ to, label, icon: Icon, badge }: ReturnType<typeof getNavItems>[number] & { badge?: string | number }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => cn(
        'group flex items-center gap-4 px-6 py-3.5 transition-all relative',
        isActive
          ? 'bg-gradient-to-r from-white/10 to-transparent text-white'
          : 'text-slate-400 hover:text-white hover:bg-white/5'
      )}
    >
      {({ isActive }) => (
        <>
          <Icon className={cn("h-5 w-5 shrink-0 transition-colors", isActive ? "text-white" : "text-slate-400 group-hover:text-white")} />
          <span className="text-[15px] font-medium leading-none">{label}</span>
          {badge && (
            <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-pink-500 text-[10px] font-bold text-white">
              {badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

function StaticNavItem({ label, icon: Icon, onClick }: { label: string, icon: any, onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full group flex items-center gap-4 px-6 py-3.5 transition-all relative text-slate-400 hover:text-white hover:bg-white/5'
      )}
    >
      <Icon className="h-5 w-5 shrink-0 transition-colors text-slate-400 group-hover:text-white" />
      <span className="text-[15px] font-medium leading-none">{label}</span>
    </button>
  )
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const items = user ? getNavItems(user.role) : []

  useEffect(() => {
    onClose()
  }, [location.pathname, onClose])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const content = (
    <div className="flex h-full flex-col bg-[#1A1C23] text-slate-300 font-sans">
      {/* Header Area */}
      <div className="pt-8 px-6 pb-6 mt-2">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center text-white">
            <LineChart className="h-7 w-7" strokeWidth={2} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold tracking-wide text-white uppercase leading-none">MEDMETRIC</h1>
            <p className="text-[11px] text-slate-400 mt-1">Medical briefing system</p>
          </div>
        </div>
      </div>

      <div className="px-6 pb-2">
        <div className="h-px w-full bg-white/5" />
      </div>

      <div className="flex-1 overflow-y-auto py-2 pb-8">
        {/* Main Menu */}
        <div className="mb-2 px-6 py-2 mt-2">
          <h2 className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">Main Menu</h2>
        </div>
        
        <nav className="space-y-1">
          {items.map(item => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>
      </div>

      {/* Footer Area */}
      <div className="mt-auto mb-6">
        <StaticNavItem label="Log Out" icon={LogOut} onClick={handleLogout} />
      </div>
    </div>
  )

  return (
    <>
      <aside className="hidden h-screen w-72 shrink-0 border-r border-[#1A1C23] bg-[#1A1C23] md:block">
        {content}
      </aside>

      <Sheet open={isOpen} onOpenChange={open => (!open ? onClose() : undefined)}>
        <SheetContent side="left" className="w-72 border-r border-[#1A1C23] bg-[#1A1C23] p-0">
          {content}
        </SheetContent>
      </Sheet>
    </>
  )
}
