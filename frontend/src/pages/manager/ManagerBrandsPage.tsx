import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { 
  PaginationBar, 
  SearchToolbar 
} from '@/components/backoffice/Workbench'
import { Badge } from '@/components/ui/Badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { EmptyState } from '@/components/backoffice/Workbench'
import { getNumberParam, getStringParam, updateSearchParams } from '@/lib/search'
import { listManagerBrands } from '@/services/backoffice'
import { LoadingState, ErrorState } from './components/ManagerHelpers'

export function ManagerBrandsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const q = getStringParam(searchParams, 'q')
  const page = getNumberParam(searchParams, 'page')

  const brandsQuery = useQuery({
    queryKey: ['manager', 'brands', q, page],
    queryFn: () => listManagerBrands({ q, page }),
  })

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-display font-semibold tracking-tight text-foreground">Marcas Asignadas</h1>
        <p className="mt-2 text-sm text-muted-foreground">Marcas en las que puedes crear materiales.</p>
      </div>

      <div className="flex flex-col gap-6">
        <SearchToolbar
          value={q ?? ''}
          onChange={value => setSearchParams(current => updateSearchParams(current, { q: value || null, page: 1 }))}
          placeholder="Buscar marcas..."
        />

        {brandsQuery.isLoading && <LoadingState message="Cargando marcas..." />}
        {brandsQuery.isError && <ErrorState message="No se pudieron cargar las marcas." />}

        {!brandsQuery.isLoading && !brandsQuery.isError && brandsQuery.data?.items.length === 0 && (
          <EmptyState title="Sin marcas" description="No tienes marcas asignadas aún." />
        )}

        {!brandsQuery.isLoading && !brandsQuery.isError && (brandsQuery.data?.items.length ?? 0) > 0 && (
          <div className="rounded-3xl border border-border/50 bg-background/50 shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-[30%]">Nombre</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="w-[10%]">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {brandsQuery.data?.items.map(item => (
                  <TableRow key={item.id} className="group transition-colors hover:bg-muted/20">
                    <TableCell className="font-medium text-foreground">{item.name}</TableCell>
                    <TableCell className="text-muted-foreground">{item.description || <span className="italic opacity-50">Sin descripción</span>}</TableCell>
                    <TableCell>
                      <Badge variant={item.active ? 'success' : 'outline'}>{item.active ? 'Activa' : 'Pausada'}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <PaginationBar
          page={brandsQuery.data?.page ?? page}
          lastPage={brandsQuery.data?.last_page ?? 1}
          total={brandsQuery.data?.total ?? 0}
          onPageChange={nextPage => setSearchParams(current => updateSearchParams(current, { page: nextPage }))}
        />
      </div>
    </div>
  )
}
