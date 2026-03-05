import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const handleCloseSidebar = useCallback(() => {
    setIsSidebarOpen(false)
  }, [])

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar isOpen={isSidebarOpen} onClose={handleCloseSidebar} />
      <main className="relative flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(46,119,112,0.14),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(198,149,76,0.14),transparent_24%)]" />
        <div className="sticky top-0 z-30 border-b border-border/70 bg-background/92 px-4 py-3 backdrop-blur md:hidden">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/90 px-3.5 py-2 text-sm font-medium text-foreground shadow-[0_10px_35px_rgba(16,41,39,0.08)] transition hover:-translate-y-0.5"
            aria-label="Abrir menu"
          >
            <Menu className="h-4 w-4" />
            Menu
          </button>
        </div>

        <div className="relative h-[calc(100vh-65px)] overflow-y-auto md:h-screen">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
