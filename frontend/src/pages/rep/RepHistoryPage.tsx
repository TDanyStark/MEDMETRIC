import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Copy, PackagePlus } from 'lucide-react'
import { toast } from 'sonner'
import { useSearchParams, Link } from 'react-router-dom'

import {
  EmptyState,
  PaginationBar,
  SearchToolbar,
} from '@/components/backoffice/Workbench'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'

import { getNumberParam, getStringParam, updateSearchParams } from '@/lib/search'
import { formatDateTime } from '@/lib/utils'
import { listRepSessions } from '@/services/rep'
import { RepSession } from '@/types/rep'
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { AddMaterialsDialog } from './components/AddMaterialsDialog'

export function RepHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = getNumberParam(searchParams, 'page')
  const q = getStringParam(searchParams, 'q')
  const date = getStringParam(searchParams, 'date')

  const sessionsQuery = useQuery({
    queryKey: ['rep', 'sessions', page, q, date],
    queryFn: () => listRepSessions({ page, q: q || undefined, date: date || undefined }),
  })

  const [addMaterialsTarget, setAddMaterialsTarget] = useState<RepSession | null>(null)

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Enlace copiado al portapapeles')
    } catch {
      toast.error('No se pudo copiar el enlace')
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-display font-semibold tracking-tight text-foreground">Historial de Sesiones</h1>
        <p className="mt-2 text-sm text-muted-foreground">Revisa las sesiones que has creado y agrega más materiales cuando lo necesites.</p>
      </div>

      <div className="flex flex-col gap-6">
        <SearchToolbar
          value={q ?? ''}
          placeholder="Buscar médico..."
          onChange={val => setSearchParams(prev => updateSearchParams(prev, { q: val || null, page: 1 }))}
          extra={(
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Filtrar por fecha:</span>
              <Input
                type="date"
                value={date ?? ''}
                onChange={e => setSearchParams(prev => updateSearchParams(prev, { date: e.target.value || null, page: 1 }))}
                className="w-40 h-10 px-3 bg-background border-border"
              />
            </div>
          )}
        />

        {sessionsQuery.isLoading && <LoadingState message="Cargando historial..." />}
        {sessionsQuery.isError && <ErrorState message="No se pudo cargar el historial." />}

        {!sessionsQuery.isLoading && !sessionsQuery.isError && sessionsQuery.data?.items.length === 0 && (
          <EmptyState title="Sin sesiones" description="Crea tu primera visita médica desde la biblioteca." />
        )}

        {!sessionsQuery.isLoading && !sessionsQuery.isError && (sessionsQuery.data?.items.length ?? 0) > 0 && (
          <div className="rounded-3xl border border-border/50 bg-background/50 shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-[30%]">Médico / Etiqueta</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead>Fecha Creación</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessionsQuery.data?.items.map(item => (
                  <TableRow key={item.id} className="group transition-colors hover:bg-muted/20">
                    <TableCell className="font-medium text-foreground">
                      {item.doctor_name || <span className="italic text-muted-foreground">Sin nombre</span>}
                      <p className="text-xs text-muted-foreground">ID {item.id}</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <span className="line-clamp-2 max-w-[250px]">{item.notes || 'Ninguna'}</span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDateTime(item.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                       <div className="flex justify-end gap-2 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAddMaterialsTarget(item)}
                            title="Agregar materiales"
                          >
                            <PackagePlus className="h-4 w-4 mr-1.5" /> Agregar
                          </Button>
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/public/visit/${item.doctor_token}`} target="_blank">
                              <ExternalLink className="h-4 w-4 mr-2" /> Abrir
                            </Link>
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => copyToClipboard(`${window.location.origin}/public/visit/${item.doctor_token}`)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                       </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <PaginationBar
          page={sessionsQuery.data?.page ?? page}
          lastPage={sessionsQuery.data?.last_page ?? 1}
          total={sessionsQuery.data?.total ?? 0}
          onPageChange={nextPage => setSearchParams(current => updateSearchParams(current, { page: nextPage }))}
        />
      </div>

      {addMaterialsTarget && (
        <AddMaterialsDialog
          session={addMaterialsTarget}
          open={!!addMaterialsTarget}
          onOpenChange={open => !open && setAddMaterialsTarget(null)}
        />
      )}
    </div>
  )
}
