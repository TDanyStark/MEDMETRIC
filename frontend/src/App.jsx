import { useState, useEffect } from 'react'
import api from './services/api'
import './App.css'

function App() {
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const data = await api.get('/health')
        setHealth(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    checkHealth()
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1>MEDMETRIC</h1>
        <p className="subtitle">Sistema de Gestión Médica</p>
      </header>

      <main className="app-main">
        {loading && <p>Cargando...</p>}
        
        {error && (
          <div className="error">
            <h2>Error de conexión</h2>
            <p>{error}</p>
            <p>Asegurate de que el backend este ejecutandose en el puerto 8081</p>
          </div>
        )}

        {health && (
          <div className="health-status">
            <h2>Estado del Sistema</h2>
            
            <div className="status-card">
              <h3>API</h3>
              <p><strong>Nombre:</strong> {health.api?.name}</p>
              <p><strong>Versión:</strong> {health.api?.version}</p>
              <p><strong>Entorno:</strong> {health.api?.environment}</p>
              <p className={`status ${health.api?.status}`}>
                Estado: {health.api?.status}
              </p>
            </div>

            <div className="status-card">
              <h3>Base de Datos</h3>
              <p className={`status ${health.database?.status}`}>
                Estado: {health.database?.status}
              </p>
              {health.database?.message && (
                <p>{health.database.message}</p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
