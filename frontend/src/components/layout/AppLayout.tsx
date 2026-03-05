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
    <div className="flex h-screen overflow-hidden bg-slate-50/50">
      <Sidebar isOpen={isSidebarOpen} onClose={handleCloseSidebar} />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            aria-label="Abrir menu"
          >
            <Menu className="h-4 w-4" />
            Menu
          </button>
        </div>

        <div className="min-h-full">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
