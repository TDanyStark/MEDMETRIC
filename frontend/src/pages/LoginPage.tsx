import { FormEvent, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { useAuth } from '@/contexts/useAuth'
import { getRoleHome } from '@/lib/auth'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import medmetricLogo from '@/assets/MEDMETRIC.svg'

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
            <img src={medmetricLogo} alt="MedMetric" className="h-[150px] w-auto mb-4" />
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
            <Input
              label="Contraseña"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Ingresa tu contraseña"
              autoComplete="current-password"
              required
            />

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
