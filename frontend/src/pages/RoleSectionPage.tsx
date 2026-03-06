import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8 animate-in fade-in duration-500">
      <Card className="border-border/50 shadow-sm bg-background/50">
        <CardContent className="p-8 md:p-12 text-center md:text-left flex flex-col md:flex-row items-center gap-8">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl border border-primary/20 bg-primary/5 text-primary">
            <Icon className="h-10 w-10" />
          </div>
          
          <div className="flex-1">
            <div className="flex justify-center md:justify-start items-center gap-2">
              <Badge variant="outline" className="bg-background">{blueprint.label}</Badge>
            </div>
            <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight text-foreground">{section.label}</h1>
            <p className="mt-2 max-w-2xl text-lg text-muted-foreground">{section.description}</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center md:justify-start mt-4">
        <Button asChild variant="outline">
          <Link to={getRoleHome(role)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al inicio
          </Link>
        </Button>
      </div>
    </div>
  )
}
