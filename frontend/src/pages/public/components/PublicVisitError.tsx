import { Badge } from '@/components/ui/Badge'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'

export function PublicVisitError() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <Badge variant="warm">Acceso publico</Badge>
          <CardTitle>Esta visita ya no esta disponible</CardTitle>
          <CardDescription>
            Revisa el enlace compartido por el visitador medico. Si el problema continua, solicita una nueva sesion.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
