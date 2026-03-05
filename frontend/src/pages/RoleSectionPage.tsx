import { ArrowLeft, ArrowRight, Clock3 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { ROLE_BLUEPRINTS, getRoleHome } from '@/lib/auth'
import { Role } from '@/types'

interface RoleSectionPageProps {
  role: Role
  path: string
}

export default function RoleSectionPage({ role, path }: RoleSectionPageProps) {
  const blueprint = ROLE_BLUEPRINTS[role]
  const section = blueprint.navigation.find(item => item.to === path) ?? blueprint.navigation[0]
  const Icon = section.icon

  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <Card>
        <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-8">
          <div>
            <Badge variant="outline">{blueprint.label}</Badge>
            <div className="mt-5 flex h-14 w-14 items-center justify-center rounded-[22px] border border-primary/20 bg-primary/10 text-primary">
              <Icon className="h-6 w-6" />
            </div>
            <h1 className="mt-5 font-display text-4xl text-foreground">{section.label}</h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-muted-foreground">{section.description}</p>
          </div>

          <div className="rounded-[32px] border border-border/70 bg-background/80 p-6">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Clock3 className="h-4 w-4 text-primary" />
              {section.phase}
            </div>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              Esta vista ya existe dentro del sistema de navegacion y mantiene consistencia visual. La logica puntual del modulo se conecta en la fase funcional correspondiente.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link to={getRoleHome(role)}>
                  <ArrowLeft className="h-4 w-4" />
                  Volver al panorama
                </Link>
              </Button>
              <Button asChild>
                <Link to={blueprint.navigation[0].to}>
                  Inicio del rol
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {[
          'Shell responsive listo para desktop y mobile.',
          'Jerarquia visual consistente con el resto de modulos.',
          'Ruta estable para conectar datos reales sin mover la UX.',
        ].map(item => (
          <Card key={item}>
            <CardHeader>
              <CardTitle className="text-xl">Base preparada</CardTitle>
              <CardDescription>{item}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  )
}
