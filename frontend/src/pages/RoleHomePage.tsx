import { ArrowRight, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/useAuth'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Separator } from '@/components/ui/Separator'
import { ROLE_BLUEPRINTS, RoleBlueprint } from '@/lib/auth'
import { Role } from '@/types'

interface RoleHomePageProps {
  role: Role
}

function HeroMetrics({ blueprint }: { blueprint: RoleBlueprint }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {[
        'Rutas protegidas por rol listas.',
        'Navegacion escalable para modulos futuros.',
        blueprint.signature,
      ].map(item => (
        <div key={item} className="rounded-[28px] border border-border/70 bg-background/80 p-4 text-sm leading-6 text-muted-foreground">
          {item}
        </div>
      ))}
    </div>
  )
}

export default function RoleHomePage({ role }: RoleHomePageProps) {
  const { user } = useAuth()
  const blueprint = ROLE_BLUEPRINTS[role]

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <Card className="overflow-hidden">
        <CardContent className="grid gap-8 p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-8">
          <div>
            <Badge variant="accent">{blueprint.eyebrow}</Badge>
            <h1 className="mt-5 font-display text-4xl leading-tight text-foreground lg:text-5xl">
              {blueprint.label} listo para crecer sin rehacer la base.
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-muted-foreground">{blueprint.intro}</p>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground">
              La Fase 8 deja el marco tecnico y visual preparado. Desde aqui cada modulo suma logica sin cambiar rutas, estructura ni experiencia principal.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild>
                <Link to={blueprint.navigation[1]?.to ?? blueprint.navigation[0].to}>
                  Explorar modulo
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <a href="/public/visit/demo-token">Vista publica</a>
              </Button>
            </div>
          </div>

          <div className="rounded-[32px] border border-border/70 bg-background/85 p-6">
            <p className="text-[0.72rem] uppercase tracking-[0.24em] text-muted-foreground">Sesion actual</p>
            <h2 className="mt-3 font-display text-3xl text-foreground">{user?.name}</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{user?.email}</p>
            <Separator className="my-5" />
            <div className="flex items-start gap-3 rounded-[24px] border border-border/70 bg-card/80 p-4 text-sm leading-6 text-muted-foreground">
              <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
              <p>
                El layout, la navegacion y los estados base ya responden al rol. La proxima fase solo conecta pantallas operativas y datos reales.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <HeroMetrics blueprint={blueprint} />

      <div className="grid gap-4 xl:grid-cols-2">
        {blueprint.navigation.map(item => {
          const Icon = item.icon

          return (
            <Card key={item.to} className="h-full">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[20px] border border-primary/20 bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <Badge variant={item.phase.includes('Base lista') ? 'success' : 'outline'}>{item.phase}</Badge>
                </div>
                <CardTitle>{item.label}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3 pt-2">
                <p className="text-sm leading-7 text-muted-foreground">Ruta preparada y enlazada dentro del shell del rol.</p>
                <Button asChild variant="ghost">
                  <Link to={item.to}>
                    Abrir
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
