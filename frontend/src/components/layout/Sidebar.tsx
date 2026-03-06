import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, ChevronLeft, Menu } from 'lucide-react'
import { useAuth } from '@/contexts/useAuth'
import { Sheet, SheetContent } from '@/components/ui/Sheet'
import { getNavItems } from '@/lib/auth'
import { cn } from '@/lib/utils'


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
        'group flex items-center transition-all duration-500 relative mx-3 rounded-xl overflow-hidden',
        isCollapsed ? 'justify-center w-12 h-12 mb-1 px-0' : 'gap-4 px-4 py-3 mb-1',
        isActive
          ? (isCollapsed ? 'bg-white/10 text-white' : 'bg-gradient-to-r from-white/10 to-transparent text-white')
          : 'text-slate-400 hover:text-white hover:bg-white/5'
      )}
    >
      {({ isActive }) => (
        <>
          <Icon className={cn(
            "shrink-0 transition-all duration-500", 
            isCollapsed ? "h-6 w-6" : "h-5 w-5", 
            isActive ? "text-white" : "text-slate-400 group-hover:text-white"
          )} />
          
          <span className={cn(
            "text-[15px] font-medium leading-none whitespace-nowrap transition-all duration-500 ease-in-out block overflow-hidden",
            isCollapsed ? "max-w-0 opacity-0 pointer-events-none" : "max-w-[200px] opacity-100 ml-4"
          )}>
            {label}
          </span>

          {badge && (
            <span className={cn(
              "flex items-center justify-center rounded-full bg-pink-500 text-white transition-all duration-500",
              isCollapsed 
                ? "absolute top-2 right-2 h-2.5 w-2.5 ring-2 ring-[#1A1C23]" 
                : "ml-auto h-5 w-5 text-[10px] font-bold"
            )}>
              {!isCollapsed && badge}
            </span>
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
        'group flex items-center transition-all duration-500 relative text-slate-400 hover:text-white hover:bg-white/5 mx-3 rounded-xl overflow-hidden',
        isCollapsed ? 'justify-center w-12 h-12' : 'w-full gap-4 px-4 py-3.5'
      )}
    >
      <Icon className={cn("shrink-0 transition-all duration-500", isCollapsed ? "h-6 w-6" : "h-5 w-5")} />
      <span className={cn(
        "text-[15px] font-medium leading-none whitespace-nowrap transition-all duration-500 ease-in-out block overflow-hidden text-left",
        isCollapsed ? "max-w-0 opacity-0 pointer-events-none" : "max-w-[200px] opacity-100 ml-4"
      )}>
        {label}
      </span>
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
    <div className="flex h-full flex-col bg-[#1A1C23] text-slate-300 font-sans transition-all duration-500">
      {/* Header Area */}
      <div className={cn("pt-8 pb-4 transition-all duration-500", collapsed ? "px-0" : "px-8")}>
        <div 
          className="relative flex items-center justify-center cursor-pointer group" 
          onClick={() => navigate('/')}
        >
          <div className={cn(
            "relative flex items-center justify-center transition-all duration-500 ease-in-out",
            collapsed ? "w-10 h-10" : "w-full h-24"
          )}>
            {/* Full Logo (MEDMETRIC.webp) - Visible when expanded */}
            <img 
              src="/MEDMETRIC.webp" 
              alt="Medmetric Logo" 
              className={cn(
                "absolute h-full w-full object-contain brightness-0 invert transition-all duration-500 ease-in-out",
                collapsed ? "opacity-0 scale-90 translate-x-[-20%] pointer-events-none" : "opacity-100 scale-100 translate-x-0"
              )} 
            />
            
            {/* Icon Logo (favicon.png) - Visible when collapsed */}
            <img 
              src="/favicon.png" 
              alt="Medmetric Icon" 
              className={cn(
                "absolute h-full w-full object-contain transition-all duration-500 ease-in-out filter brightness-0 invert",
                collapsed ? "opacity-100 scale-100 translate-x-0" : "opacity-0 scale-75 translate-x-[20%] pointer-events-none"
              )} 
            />
          </div>
        </div>
      </div>

      <div className={cn("pb-2 transition-all duration-500", collapsed ? "px-4" : "px-8")}>
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
              "group flex items-center justify-center transition-all duration-500 text-slate-500 hover:text-white rounded-xl bg-black/20 hover:bg-black/40",
              collapsed ? "w-12 h-12" : "w-[calc(100%-24px)] mx-3 h-12 gap-6"
            )}
            title={collapsed ? "Expandir menú" : "Ocultar menú"}
          >
            {collapsed ? (
              <Menu className="h-6 w-6 transition-transform duration-500 group-hover:scale-110" />
            ) : (
              <div className="flex items-center gap-2">
                <ChevronLeft className="h-5 w-5 transition-transform duration-500 group-hover:-translate-x-1" />
                <Menu className="h-5 w-5" />
              </div>
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
          "hidden h-screen shrink-0 border-r border-[#1A1C23] bg-[#1A1C23] md:block transition-all duration-500",
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
