import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, ChevronLeft, Menu } from 'lucide-react'
import { useAuth } from '@/contexts/useAuth'
import { Sheet, SheetContent } from '@/components/ui/Sheet'
import { getNavItems } from '@/lib/auth'
import { cn } from '@/lib/utils'
import medmetricLogoBlanco from '@/assets/MEDMETRIC_blanco.svg'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

function NavItem({ to, label, icon: Icon, badge, isCollapsed }: ReturnType<typeof getNavItems>[number] & { badge?: string | number, isCollapsed?: boolean }) {
  return (
    <NavLink
      to={to}
      title={isCollapsed ? label : undefined}
      className={({ isActive }) => cn(
        'group flex items-center transition-all relative',
        isCollapsed ? 'justify-center mx-auto w-12 h-12 rounded-xl mb-1' : 'gap-4 px-6 py-3.5',
        isActive
          ? (isCollapsed ? 'bg-white/10 text-white' : 'bg-gradient-to-r from-white/10 to-transparent text-white')
          : 'text-slate-400 hover:text-white hover:bg-white/5'
      )}
    >
      {({ isActive }) => (
        <>
          <Icon className={cn("shrink-0 transition-colors", isCollapsed ? "h-6 w-6" : "h-5 w-5", isActive ? "text-white" : "text-slate-400 group-hover:text-white")} />
          {!isCollapsed && <span className="text-[15px] font-medium leading-none whitespace-nowrap">{label}</span>}
          {badge && !isCollapsed && (
            <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-pink-500 text-[10px] font-bold text-white">
              {badge}
            </span>
          )}
          {badge && isCollapsed && (
            <span className="absolute top-2 right-2 flex h-2.5 w-2.5 rounded-full bg-pink-500 ring-2 ring-[#1A1C23]" />
          )}
        </>
      )}
    </NavLink>
  )
}

function StaticNavItem({ label, icon: Icon, onClick, isCollapsed }: { label: string, icon: any, onClick?: () => void, isCollapsed?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={isCollapsed ? label : undefined}
      className={cn(
        'group flex items-center transition-all relative text-slate-400 hover:text-white hover:bg-white/5',
        isCollapsed ? 'justify-center mx-auto w-12 h-12 rounded-xl' : 'w-full gap-4 px-6 py-3.5'
      )}
    >
      <Icon className={cn("shrink-0 transition-colors text-slate-400 group-hover:text-white", isCollapsed ? "h-6 w-6" : "h-5 w-5")} />
      {!isCollapsed && <span className="text-[15px] font-medium leading-none whitespace-nowrap">{label}</span>}
    </button>
  )
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Collapse by default on tablet sizes (iPad), expand on large desktop
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768 && window.innerWidth < 1024
    }
    return false
  })

  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-width', isCollapsed ? '5rem' : '18rem')
  }, [isCollapsed])

  const items = user ? getNavItems(user.role) : []

  useEffect(() => {
    onClose()
  }, [location.pathname, onClose])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const renderContent = (collapsed: boolean) => (
    <div className="flex h-full flex-col bg-[#1A1C23] text-slate-300 font-sans transition-all duration-300">
      {/* Header Area */}
      <div className={cn("pt-8 pb-6 mt-2", collapsed ? "px-0 flex justify-center" : "px-6")}>
        <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}>
          <div className="flex h-10 w-auto shrink-0 items-center justify-center overflow-hidden rounded-md">
            <img src={medmetricLogoBlanco} alt="MedMetric Logo" className="h-full w-full object-contain" />
          </div>
        </div>
      </div>

      <div className={cn("pb-2", collapsed ? "px-4" : "px-6")}>
        <div className="h-px w-full bg-white/5" />
      </div>

      <div className="flex-1 overflow-y-auto py-2 pb-8 custom-scrollbar">
        {/* Main Menu */}
        {!collapsed && (
          <div className="mb-2 px-6 py-2 mt-2">
            <h2 className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">Main Menu</h2>
          </div>
        )}
        
        <nav className={cn("space-y-1", collapsed && "px-2 pt-4")}>
          {items.map(item => (
            <NavItem key={item.to} {...item} isCollapsed={collapsed} />
          ))}
        </nav>
      </div>

      {/* Footer Area */}
      <div className="mt-auto mb-4 space-y-2">
        <StaticNavItem label="Log Out" icon={LogOut} onClick={handleLogout} isCollapsed={collapsed} />
        
        {/* Toggle Collapse Button (Only visibly useful on desktop/tablet) */}
        <div className="hidden md:flex justify-center pb-2">
          <button
            onClick={() => setIsCollapsed(!collapsed)}
            className={cn(
              "group flex items-center justify-center transition-all text-slate-500 hover:text-white rounded-xl bg-black/20 hover:bg-black/40",
              collapsed ? "w-12 h-12" : "w-full mx-6 h-12 gap-6"
            )}
            title={collapsed ? "Expandir menú" : "Ocultar menú"}
          >
            {collapsed ? (
              <Menu className="h-6 w-6" />
            ) : (
              <>
                <ChevronLeft className="h-5 w-5" />
                <Menu className="h-5 w-5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <aside 
        className={cn(
          "hidden h-screen shrink-0 border-r border-[#1A1C23] bg-[#1A1C23] md:block transition-all duration-300",
          isCollapsed ? "w-20" : "w-72"
        )}
      >
        {renderContent(isCollapsed)}
      </aside>

      {/* Mobile Sidebar (always full width when open) */}
      <Sheet open={isOpen} onOpenChange={open => (!open ? onClose() : undefined)}>
        <SheetContent side="left" className="w-72 border-r border-[#1A1C23] bg-[#1A1C23] p-0">
          {renderContent(false)}
        </SheetContent>
      </Sheet>
    </>
  )
}
