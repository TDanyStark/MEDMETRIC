import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/useAuth'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { ROLE_BLUEPRINTS } from '@/lib/auth'
import { Role } from '@/types'

interface RoleHomePageProps {
  role: Role
}

export default function RoleHomePage({ role }: RoleHomePageProps) {
  const { user } = useAuth()
  const blueprint = ROLE_BLUEPRINTS[role]
  
  // Omit the first navigation item if it is just a link back to this overview
  const navigationItems = blueprint.navigation.filter(item => item.to !== blueprint.navigation[0].to)

  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 animate-in fade-in duration-500">
      
      {/* Encabezado limpio */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl leading-tight text-foreground font-semibold">
            Hola, {user?.name?.split(' ')[0] || 'Usuario'}
          </h1>
          <p className="mt-2 text-base text-muted-foreground max-w-2xl">
            {blueprint.intro}
          </p>
        </div>
        
        <div className="text-sm text-right text-muted-foreground hidden md:block">
          <p className="font-semibold text-foreground">{blueprint.label}</p>
          <p>{user?.email}</p>
        </div>
      </div>

      <div className="mt-4">
        <h2 className="text-xl font-semibold mb-4 text-foreground">Accesos Rápidos</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {navigationItems.map(item => {
            const Icon = item.icon

            return (
              <Card key={item.to} className="h-full hover:border-primary/30 transition-colors group">
                <CardHeader className="pb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/5 text-primary group-hover:bg-primary/10 transition-colors">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="mt-4">{item.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="mb-4 min-h-[40px]">
                    {item.description}
                  </CardDescription>
                  <Button asChild variant="ghost" className="w-full justify-between -mx-2 px-2 hover:bg-muted/50">
                    <Link to={item.to}>
                      Acceder al módulo
                      <ArrowRight className="h-4 w-4 opacity-50 group-hover:opacity-100 transition-opacity translate-x-0 group-hover:translate-x-1" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
      
    </div>
  )
}
