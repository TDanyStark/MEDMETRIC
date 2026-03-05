import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <p className="text-6xl font-bold text-slate-200">404</p>
      <h1 className="text-lg font-semibold text-slate-900">Página no encontrada</h1>
      <p className="text-sm text-slate-500">La ruta que buscas no existe.</p>
      <Link to="/" className="text-sm text-teal-600 hover:underline">Ir al inicio</Link>
    </div>
  )
}
