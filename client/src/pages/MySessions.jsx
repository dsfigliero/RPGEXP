import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'

export default function MySessions() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/sessions').then(r => setSessions(r.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="page"><div className="spinner" /></div>

  return (
    <div className="page">
      <div className="page-header">
        <h1>Minhas Sessões</h1>
      </div>

      {sessions.length === 0
        ? <div className="card text-muted text-sm">Você ainda não participou de nenhuma sessão.</div>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {sessions.map(s => (
              <div key={s.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{s.name}</div>
                    {s.campaign_name && <div className="text-muted text-sm">{s.campaign_name}</div>}
                    <div className="text-muted text-sm">{new Date(s.date).toLocaleDateString('pt-BR')}</div>
                  </div>
                  <span className={`badge ${s.is_finalized ? 'badge-green' : 'badge-yellow'}`}>
                    {s.is_finalized ? 'Finalizada' : 'Em andamento'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Link to={`/sessions/${s.id}`} className="btn-ghost btn-sm">Ver detalhes</Link>
                  {!s.is_finalized && (
                    <Link to={`/sessions/${s.id}/live`} className="btn-primary btn-sm">🔴 Ao Vivo</Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}
