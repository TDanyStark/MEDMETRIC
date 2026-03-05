import { useState, useCallback, useRef } from 'react'
import { CheckCircle, XCircle, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { ToastContext } from './ToastContextValue'

let _id = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current[id])
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback(({ message, type = 'success', duration = 4000 }) => {
    const id = ++_id
    setToasts(prev => [...prev, { id, message, type }])
    timers.current[id] = setTimeout(() => dismiss(id), duration)
  }, [dismiss])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80">
        {toasts.map(t => (
          <div
            key={t.id}
            className={cn(
              'flex items-start gap-3 rounded-lg border px-4 py-3 shadow-md text-sm',
              'animate-in slide-in-from-bottom-2 duration-200',
              t.type === 'success' && 'bg-teal-50 border-teal-200 text-teal-900',
              t.type === 'error'   && 'bg-red-50 border-red-200 text-red-900',
            )}
          >
            {t.type === 'success'
              ? <CheckCircle className="h-4 w-4 mt-0.5 shrink-0 text-teal-600" />
              : <XCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-500" />
            }
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="shrink-0 text-current opacity-50 hover:opacity-80">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}


