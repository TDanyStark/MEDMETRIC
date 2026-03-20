import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LogOut,
  ChevronLeft,
  ChevronRight,
  User as UserIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/useAuth";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/Sheet";
import { Avatar, AvatarFallback } from "@/components/ui/Avatar";
import { getNavItems } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { ChangePasswordDialog } from "../auth/ChangePasswordDialog";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

function NavItem({
  to,
  label,
  icon: Icon,
  badge,
  isCollapsed,
}: ReturnType<typeof getNavItems>[number] & {
  badge?: string | number;
  isCollapsed?: boolean;
}) {
  return (
    <NavLink
      to={to}
      title={isCollapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          "group flex items-center transition-all duration-300 relative mx-3 rounded-xl overflow-hidden",
          isCollapsed
            ? "justify-center w-12 h-12 mb-2 px-0"
            : "gap-3 px-4 py-3 mb-1",
          isActive
            ? "bg-primary/20 text-white shadow-lg shadow-primary/5"
            : "text-slate-400 hover:text-white hover:bg-white/5",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && !isCollapsed && (
            <div className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-primary" />
          )}
          <Icon
            className={cn(
              "shrink-0 transition-all duration-300",
              isCollapsed ? "h-6 w-6" : "h-5 w-5",
              "text-slate-400 group-hover:text-white",
            )}
          />

          <span
            className={cn(
              "text-[15px] font-medium leading-none whitespace-nowrap transition-all duration-300 ease-in-out block overflow-hidden",
              isCollapsed
                ? "max-w-0 opacity-0 pointer-events-none"
                : "max-w-[200px] opacity-100 ml-1",
            )}
          >
            {label}
          </span>

          {badge && (
            <span
              className={cn(
                "flex items-center justify-center rounded-full bg-primary text-white transition-all duration-300",
                isCollapsed
                  ? "absolute top-1.5 right-1.5 h-3 w-3 ring-2 ring-[#121418]"
                  : "ml-auto h-5 w-5 text-[10px] font-bold",
              )}
            >
              {!isCollapsed && badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sidebar_collapsed");
      if (saved !== null) return saved === "true";
      return window.innerWidth >= 768 && window.innerWidth < 1024;
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem("sidebar_collapsed", String(isCollapsed));
    document.documentElement.style.setProperty(
      "--sidebar-width",
      isCollapsed ? "5rem" : "18rem",
    );
  }, [isCollapsed]);

  const items = user ? getNavItems(user.role) : [];

  useEffect(() => {
    onClose();
  }, [location.pathname, onClose]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const renderContent = (collapsed: boolean, isMobile = false) => (
    <div className="flex h-full flex-col bg-[#121418] text-slate-300 font-sans transition-all duration-500 relative border-r border-white/5">
      {/* Header Area */}
      <div
        className={cn(
          "pt-10 pb-6 transition-all duration-500",
          collapsed ? "px-0" : "px-8",
        )}
      >
        <div
          className="relative flex items-center justify-center cursor-pointer group"
          onClick={() => navigate("/")}
        >
          <div
            className={cn(
              "relative flex items-center justify-center transition-all duration-500 ease-in-out",
              collapsed ? "w-10 h-10" : "w-full h-20",
            )}
          >
            <img
              src="/MEDMETRIC.webp"
              alt="Medmetric Logo"
              className={cn(
                "absolute h-full w-full object-contain brightness-0 invert transition-all duration-500 ease-in-out",
                collapsed
                  ? "opacity-0 scale-90 translate-x-[-20%] pointer-events-none"
                  : "opacity-100 scale-100 translate-x-0",
              )}
            />

            <img
              src="/favicon.png"
              alt="Medmetric Icon"
              className={cn(
                "absolute h-full w-full object-contain transition-all duration-500 ease-in-out filter brightness-0 invert",
                collapsed
                  ? "opacity-100 scale-100 translate-x-0"
                  : "opacity-0 scale-75 translate-x-[20%] pointer-events-none",
              )}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pt-2 pb-6 custom-scrollbar px-3">
        {/* Navigation */}
        <nav className="space-y-1">
          {items.map((item) => (
            <NavItem key={item.to} {...item} isCollapsed={collapsed} />
          ))}
        </nav>
      </div>

      {/* Footer Area with User Profile */}
      <div
        className={cn(
          "mt-auto border-t border-white/5 p-4 bg-white/[0.02] transition-all duration-300",
          collapsed ? "px-2" : "px-4",
        )}
      >
        <div
          onClick={() => setIsChangePasswordOpen(true)}
          className={cn(
            "relative flex items-center rounded-2xl bg-white/5 p-2 transition-all duration-300 hover:bg-white/10 group overflow-hidden cursor-pointer",
            collapsed ? "justify-center" : "gap-3",
          )}
        >
          <Avatar className="h-10 w-10 shrink-0 border border-primary/20">
            <AvatarFallback className="bg-white text-primary font-bold uppercase text-xs">
              {user?.name?.substring(0, 2) || <UserIcon className="h-4 w-4" />}
            </AvatarFallback>
          </Avatar>

          {!collapsed && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <span className="truncate text-[13px] font-bold text-white leading-tight">
                {user?.name}
              </span>
              <span className="truncate text-[11px] text-slate-500 capitalize font-medium">
                {user?.role?.replace("_", " ")}
              </span>
            </div>
          )}

          {!collapsed && (
            <button
              onClick={handleLogout}
              className="rounded-xl p-2.5 text-slate-400 hover:bg-destructive/10 hover:text-destructive transition-all duration-300"
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}

          {collapsed && (
            <button
              onClick={handleLogout}
              className="absolute inset-0 z-10 opacity-0 group-hover:opacity-100 flex items-center justify-center bg-destructive text-white transition-all duration-300 backdrop-blur-sm"
              title="Cerrar sesión"
            >
              <LogOut className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Desktop Toggle Button (Absolute positioned on the border) */}
      {!isMobile && (
        <button
          onClick={() => setIsCollapsed(!collapsed)}
          className={cn(
            "absolute -right-3.5 top-24 z-50 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-[#121418] text-slate-400 shadow-xl transition-all hover:scale-110 hover:text-white",
            "hidden md:flex",
          )}
          title={collapsed ? "Expandir" : "Contraer"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      )}
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          "hidden h-screen shrink-0 md:block transition-all duration-500 ease-in-out",
          isCollapsed ? "w-20" : "w-72",
        )}
      >
        {renderContent(isCollapsed)}
      </aside>

      {/* Mobile Sidebar */}
      <Sheet
        open={isOpen}
        onOpenChange={(open) => (!open ? onClose() : undefined)}
      >
        <SheetContent
          side="left"
          className="w-[280px] border-none bg-transparent p-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Menú de Navegación</SheetTitle>
            <SheetDescription>
              Selecciona una opción del menú para navegar por la aplicación.
            </SheetDescription>
          </SheetHeader>
          {renderContent(false, true)}
        </SheetContent>
      </Sheet>

      <ChangePasswordDialog
        open={isChangePasswordOpen}
        onOpenChange={setIsChangePasswordOpen}
      />
    </>
  );
}
