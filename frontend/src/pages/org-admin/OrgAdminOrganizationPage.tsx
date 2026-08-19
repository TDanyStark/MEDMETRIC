import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { TimezoneSelect } from '@/components/backoffice/TimezoneSelect'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card'
import { useDidDepsChange } from '@/hooks/useDidDepsChange'
import { useAuth } from '@/contexts/useAuth'
import { getUserFriendlyErrorMessage } from '@/services/api'
import { getMyOrganization, updateMyOrganizationTimezone } from '@/services/backoffice'
import { LoadingState } from './components/LoadingState'
import { ErrorState } from './components/ErrorState'

/**
 * org_admin self-service organization settings. Minimal by design: the
 * only editable field today is the organization's timezone (used to
 * localize date filters and displayed dates across the platform). Name,
 * slug and active status remain superadmin-only, managed from
 * /superadmin/organizations.
 */
export function OrgAdminOrganizationPage() {
  const queryClient = useQueryClient()
  const { syncSession } = useAuth()
  const [timezone, setTimezone] = useState<string | null>(null)

  const organizationQuery = useQuery({
    queryKey: ['org-admin', 'organization'],
    queryFn: getMyOrganization,
  })

  // Sync the editable timezone field once the organization query resolves.
  // Adjusted during render, not in an effect.
  if (useDidDepsChange([organizationQuery.data]) && organizationQuery.data) {
    setTimezone(organizationQuery.data.timezone)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!timezone) {
        throw new Error('Selecciona una zona horaria.')
      }
      return updateMyOrganizationTimezone({ timezone })
    },
    onSuccess: () => {
      toast.success('Zona horaria actualizada.')
      void queryClient.invalidateQueries({ queryKey: ['org-admin', 'organization'] })
      // The changing admin's own auth_user.organization_timezone (cached from
      // Login/Me) would otherwise stay stale until next re-login, so dates
      // across the app keep rendering in the OLD zone. Re-sync from /auth/me.
      void syncSession()
    },
    onError: error => {
      toast.error(getUserFriendlyErrorMessage(error, 'No se pudo actualizar la zona horaria.'))
    },
  })

  const hasChanges = !!organizationQuery.data && timezone !== organizationQuery.data.timezone

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-display font-semibold tracking-tight text-foreground">Organización</h1>
        <p className="mt-2 text-sm text-muted-foreground">Configuración general de tu organización.</p>
      </div>

      {organizationQuery.isLoading && <LoadingState message="Cargando organización..." />}
      {organizationQuery.isError && <ErrorState message="No se pudo cargar la organización." />}

      {organizationQuery.data && (
        <Card>
          <CardHeader>
            <CardTitle>{organizationQuery.data.name}</CardTitle>
            <CardDescription>
              La zona horaria determina cómo se agrupan y muestran las fechas de métricas, comentarios y sesiones de visita en toda la plataforma.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="max-w-sm"
              onSubmit={event => {
                event.preventDefault()
                void saveMutation.mutateAsync()
              }}
            >
              <TimezoneSelect instanceId="org-admin-timezone" value={timezone} onChange={setTimezone} required />
            </form>
          </CardContent>
          <CardFooter className="justify-end border-t border-border/50 pt-6">
            <Button
              type="button"
              disabled={!hasChanges}
              loading={saveMutation.isPending}
              onClick={() => void saveMutation.mutateAsync()}
            >
              Guardar Cambios
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}
