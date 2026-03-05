import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-xl text-center">
        <CardContent className="p-8 sm:p-10">
          <p className="font-display text-7xl text-primary/25">404</p>
          <h1 className="mt-4 font-display text-4xl text-foreground">Ruta no encontrada</h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-muted-foreground">
            Esta direccion no forma parte del recorrido actual. Vuelve al inicio para entrar al modulo correcto.
          </p>
          <Button asChild className="mt-8">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
              Ir al inicio
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
