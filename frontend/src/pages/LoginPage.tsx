import { FormEvent, useState } from 'react'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { useAuth } from '@/contexts/useAuth'
import { getRoleHome } from '@/lib/auth'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'


export default function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
      const message = err instanceof Error ? err.message : 'Credenciales inválidas.'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background px-4 py-8 md:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(46,119,112,0.1),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(198,149,76,0.1),transparent_30%)]" />

      <Card className="w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-500 shadow-xl border-border/50 bg-background/80 backdrop-blur-sm z-10">
        <CardContent className="p-8 sm:p-10">
          <div className="text-center flex flex-col items-center">
            <img src="/MEDMETRIC.webp" alt="Medmetric Logo" className="h-[150px] w-auto mb-4" />
            <p className="mt-2 text-sm text-muted-foreground">Inicia sesión en tu cuenta para continuar</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <Input
              label="Correo electrónico"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="nombre@empresa.com"
              autoComplete="email"
              required
            />
            <div className="flex flex-col gap-2">
              <label className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Ingresa tu contraseña"
                  autoComplete="current-password"
                  required
                  className="flex h-12 w-full rounded-[20px] border border-input bg-background pl-4 pr-12 text-sm text-foreground shadow-sm transition outline-none placeholder:text-muted-foreground focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full p-1.5 text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive text-center">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" loading={loading}>
              Ingresar
              {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
