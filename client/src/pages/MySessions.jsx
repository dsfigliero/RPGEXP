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
          <div className="card" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Sessão</th>
                  <th>Campanha</th>
                  <th>Data</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td className="text-muted">{s.campaign_name || '—'}</td>
                    <td>{new Date(s.date).toLocaleDateString('pt-BR')}</td>
                    <td>
                      <span className={`badge ${s.is_finalized ? 'badge-green' : 'badge-yellow'}`}>
                        {s.is_finalized ? 'Finalizada' : 'Em andamento'}
                      </span>
                    </td>
                    <td><Link to={`/sessions/${s.id}`} style={{ fontSize: '0.85rem' }}>Ver detalhes →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  )
}
