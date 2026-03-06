import { useEffect, useState } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useSearchParams } from 'react-router-dom'

import {
  ChoicePills,
  PaginationBar,
  SearchToolbar,
} from '@/components/backoffice/Workbench'
import { Button } from '@/components/ui/Button'

import { getNullableNumberParam, getNumberParam, getStringParam, updateSearchParams } from '@/lib/search'
import {
  assignBrandsToManager,
  getManagerAssignedBrands,
  listOrgBrands,
  listOrgUsers,
  removeBrandsFromManager,
} from '@/services/backoffice'

import { LoadingState } from './components/LoadingState'

export function OrgAdminAssignmentsPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const q = getStringParam(searchParams, 'q')
  const page = getNumberParam(searchParams, 'page')
  const managerId = getNullableNumberParam(searchParams, 'manager_id')
  const [draftBrandIds, setDraftBrandIds] = useState<number[]>([])

  const [managersQuery, brandsQuery] = useQueries({
    queries: [
      {
        queryKey: ['org-admin', 'assignment-managers', q, page],
        queryFn: () => listOrgUsers({ role: 'manager', q, page }),
      },
      {
        queryKey: ['org-admin', 'assignment-brands'],
        queryFn: () => listOrgBrands({ page: 1 }), // Assuming we want almost all active brands
      },
    ],
  })

  const assignedBrandsQuery = useQuery({
    queryKey: ['org-admin', 'manager-brands', managerId],
    queryFn: () => getManagerAssignedBrands(managerId!, { page: 1 }),
    enabled: managerId !== null,
  })

  useEffect(() => {
    if (assignedBrandsQuery.data) {
      setDraftBrandIds(assignedBrandsQuery.data.items.map(item => item.id))
    } else {
      setDraftBrandIds([])
    }
  }, [assignedBrandsQuery.data, managerId])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!managerId) throw new Error('Selecciona un gerente.')

      const currentIds = assignedBrandsQuery.data?.items.map(item => item.id) ?? []
      const toAssign = draftBrandIds.filter(id => !currentIds.includes(id))
      const toRemove = currentIds.filter(id => !draftBrandIds.includes(id))

      if (toAssign.length > 0) await assignBrandsToManager(managerId, toAssign)
      if (toRemove.length > 0) await removeBrandsFromManager(managerId, toRemove)
    },
    onSuccess: () => {
      toast.success('Asignaciones guardadas.')
      void queryClient.invalidateQueries({ queryKey: ['org-admin', 'manager-brands', managerId] })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'No se pudieron guardar las asignaciones.'
      toast.error(message)
    },
  })

  const selectedManager = managersQuery.data?.items.find(item => item.id === managerId) ?? null

  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:px-8 animate-in fade-in duration-500">
      
      {/* Left panel: Managers */}
      <div className="w-1/3 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-display font-semibold tracking-tight text-foreground">Gerentes</h1>
          <p className="mt-2 text-sm text-muted-foreground">Selecciona un gerente para asignar marcas.</p>
        </div>

        <SearchToolbar
          value={q ?? ''}
          onChange={value => setSearchParams(current => updateSearchParams(current, { q: value || null, page: 1 }))}
          placeholder="Buscar..."
        />

        {managersQuery.isLoading && <LoadingState message="Cargando..." />}
        
        <div className="space-y-2 overflow-y-auto max-h-[60vh] pr-2">
          {(managersQuery.data?.items ?? []).map(item => (
            <button
              key={item.id}
              onClick={() => setSearchParams(current => updateSearchParams(current, { manager_id: item.id }))}
              className={`w-full p-4 rounded-2xl text-left transition-all duration-200 border ${
                item.id === managerId 
                  ? 'bg-primary/10 border-primary text-primary shadow-sm' 
                  : 'bg-background hover:bg-muted/50 border-border/50 text-foreground'
              }`}
            >
              <p className="font-semibold">{item.name}</p>
              <p className="text-xs opacity-70 truncate">{item.email}</p>
            </button>
          ))}
        </div>
        
        <PaginationBar
          page={managersQuery.data?.page ?? page}
          lastPage={managersQuery.data?.last_page ?? 1}
          total={managersQuery.data?.total ?? 0}
          onPageChange={nextPage => setSearchParams(current => updateSearchParams(current, { page: nextPage }))}
        />
      </div>

      {/* Right panel: Assigments */}
      <div className="w-2/3 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-display font-semibold tracking-tight text-foreground">
            {selectedManager ? `Marcas de ${selectedManager.name}` : 'Asignaciones'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {selectedManager ? 'Elige las marcas que este gerente administrará.' : 'Selecciona un gerente a la izquierda.'}
          </p>
        </div>

        {!managerId && (
          <div className="h-full min-h-[40vh] rounded-3xl border border-dashed border-border/50 flex items-center justify-center text-muted-foreground bg-muted/10">
            <p>Selecciona un gerente para ver sus asignaciones.</p>
          </div>
        )}

        {managerId && (
          <div className="bg-background/50 rounded-3xl border border-border/50 p-6 shadow-sm flex flex-col gap-6">
             <ChoicePills
                value={draftBrandIds}
                onToggle={brandId => setDraftBrandIds(current => current.includes(brandId) ? current.filter(item => item !== brandId) : [...current, brandId])}
                options={(brandsQuery.data?.items ?? []).map(item => ({
                  value: item.id,
                  label: item.name,
                  hint: item.description ?? '',
                  disabled: !item.active,
                }))}
              />
              
              <div className="flex justify-start gap-3 mt-4 pt-6 border-t border-border/20">
                <Button loading={saveMutation.isPending} onClick={() => void saveMutation.mutateAsync()}>Guardar Asignaciones</Button>
                <Button variant="ghost" onClick={() => setDraftBrandIds(assignedBrandsQuery.data?.items.map(item => item.id) ?? [])}>Deshacer cambios</Button>
              </div>
          </div>
        )}
      </div>
    </div>
  )
}
