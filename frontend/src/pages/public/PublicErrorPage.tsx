import { AlertCircle, ArrowLeft } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'

export default function PublicErrorPage() {
  const [searchParams] = useSearchParams()
  const title = searchParams.get('title') || 'Enlace no válido'
  const message = searchParams.get('msg') || 'El enlace que intentas abrir es incorrecto, ha expirado o no tienes permisos para verlo.'

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-xl text-center border-destructive/20 shadow-2xl shadow-destructive/5 animate-in fade-in zoom-in duration-500">
        <CardContent className="p-8 sm:p-12">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-8">
            <AlertCircle className="h-10 w-10" />
          </div>
          
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          
          <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-muted-foreground/80">
            {message}
          </p>
          
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild variant="outline" className="w-full sm:w-auto h-12 px-8 rounded-2xl">
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Ir al inicio
              </Link>
            </Button>
          </div>
          
          <p className="mt-8 text-xs text-muted-foreground/40 font-medium uppercase tracking-widest">
            MedMetric Systems
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
