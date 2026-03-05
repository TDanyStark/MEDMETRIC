import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './Button'

interface PaginationProps {
  page: number;
  lastPage: number;
  total: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export function Pagination({ page, lastPage, total, onPageChange, isLoading }: PaginationProps) {
  if (total === 0 || lastPage <= 1) return null

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-white sm:px-6">
      <div className="flex flex-1 justify-between sm:hidden">
        <Button
          variant="secondary"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1 || isLoading}
        >
          Anterior
        </Button>
        <Button
          variant="secondary"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= lastPage || isLoading}
        >
          Siguiente
        </Button>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-xs text-slate-500">
            Total: <span className="font-medium text-slate-900">{total}</span> resultados
          </p>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-xs text-slate-500 mr-2">
            Página <span className="font-medium text-slate-900">{page}</span> de <span className="font-medium text-slate-900">{lastPage}</span>
          </p>
          <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
            <Button
              variant="secondary"
              size="sm"
              className="rounded-r-none px-2"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1 || isLoading}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="rounded-l-none px-2"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= lastPage || isLoading}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </nav>
        </div>
      </div>
    </div>
  )
}
