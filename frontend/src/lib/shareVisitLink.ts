import { useAuthStore } from '@/contexts/useAuth'
import { copyToClipboard } from '@/lib/clipboard'
import { buildPublicVisitUrl, buildShareMessage } from '@/lib/share'

export interface VisitShareContext {
  repName?: string | null
  organizationName?: string | null
}

/**
 * Copia al portapapeles el mensaje contextual completo (contexto + enlace) de
 * una sesion de visita. Punto unico de composicion: cualquier cambio futuro de
 * la plantilla, del toast o de los valores se hace AQUI y en ningun call site.
 *
 * Las vistas internas resuelven representante y organizacion desde auth. Las
 * vistas publicas deben pasar el contexto confiable entregado por su endpoint.
 * Opcionalmente pueden aportar una URL de recurso directo sin duplicar el
 * mensaje contextual ni la logica de portapapeles.
 */
export async function copyVisitShareMessage(
   token: string,
   doctorName?: string | null,
   context?: VisitShareContext,
   url?: string,
): Promise<boolean> {
   const user = context === undefined ? useAuthStore.getState().user : null

   const message = buildShareMessage({
     doctorName,
     repName: context?.repName ?? user?.name,
     organizationName: context?.organizationName ?? user?.organization_name,
     url: url ?? buildPublicVisitUrl(token),
   })

  return copyToClipboard(message, 'Mensaje copiado al portapapeles', 'No se pudo copiar el mensaje')
}
