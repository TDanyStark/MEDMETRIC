import { FormEvent, useState } from 'react'
import { ArrowRight, ShieldCheck, Sparkles, Stethoscope } from 'lucide-react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/useAuth'
import { getRoleHome } from '@/lib/auth'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'

export default function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) {
    return <Navigate to={getRoleHome(user.role)} replace />
  }

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? null

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const nextUser = await login(email, password)

      if (from) {
        navigate(from, { replace: true })
        return
      }

      navigate(getRoleHome(nextUser.role), { replace: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Credenciales invalidas.'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background px-4 py-8 md:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(46,119,112,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(198,149,76,0.14),transparent_24%)]" />
      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="hidden overflow-hidden lg:block">
          <CardContent className="flex h-full flex-col justify-between p-10">
            <div>
              <Badge variant="accent">Frontend base listo</Badge>
              <h1 className="mt-6 max-w-xl font-display text-5xl leading-tight text-foreground">
                Consola clinico-editorial para coordinar materiales, equipos y visitas.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground">
                MedMetric arranca con una base visual pensada para trabajo operativo real: rutas por rol, navegacion clara y un acceso publico preparado para la visita medica.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  icon: ShieldCheck,
                  title: 'Roles claros',
                  description: 'Superadmin, org admin, gerente y visitador con recorridos separados.',
                },
                {
                  icon: Sparkles,
                  title: 'Base moderna',
                  description: 'Tailwind v4, componentes estilo shadcn y feedback con Sonner.',
                },
                {
                  icon: Stethoscope,
                  title: 'Visita lista',
                  description: 'Ruta publica para medico preparada desde esta fase.',
                },
              ].map(item => {
                const Icon = item.icon

                return (
                  <div key={item.title} className="rounded-[28px] border border-border bg-background p-5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h2 className="mt-4 text-lg font-semibold text-foreground">{item.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center">
          <Card className="w-full overflow-hidden animate-in fade-in duration-500">
            <CardContent className="p-6 sm:p-8">
              <Badge variant="outline">Acceso interno</Badge>
              <div className="mt-5">
                <p className="text-[0.72rem] uppercase tracking-[0.24em] text-muted-foreground">MedMetric</p>
                <h2 className="mt-3 font-display text-4xl tracking-tight text-foreground">Iniciar sesion</h2>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  Entra a tu modulo para administrar la operacion o preparar una visita medica.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <Input
                  label="Correo electronico"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="correo@empresa.com"
                  autoComplete="email"
                  required
                />
                <Input
                  label="Contrasena"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Ingresa tu contrasena"
                  autoComplete="current-password"
                  required
                />

                {error && (
                  <div className="rounded-[24px] border border-destructive/15 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full" size="lg" loading={loading}>
                  Entrar al sistema
                  {!loading && <ArrowRight className="h-4 w-4" />}
                </Button>
              </form>

              <div className="mt-8 rounded-[24px] border border-border bg-background p-4 text-sm leading-6 text-muted-foreground">
                Toda llamada del frontend usa rutas relativas sobre <code className="rounded bg-secondary px-1.5 py-0.5 text-foreground">/api</code>, lista para Vite local y deploy en Hostinger.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
