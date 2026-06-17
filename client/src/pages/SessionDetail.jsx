import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../AuthContext'

export default function SessionDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/sessions/${id}`).then(r => setSession(r.data)).finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="page"><div className="spinner" /></div>
  if (!session) return <div className="page"><p className="text-muted">Sessão não encontrada.</p></div>

  const myCharIds = new Set(
    session.participants.filter(p => p.user_id === user?.id).map(p => p.id)
  )

  const myActions = session.actions.filter(a => myCharIds.has(a.character_id))
  const myXP = session.xp_records.filter(r => myCharIds.has(r.character_id))
  const totalMyXP = myXP.reduce((s, r) => s + r.xp_granted, 0)

  return (
    <div className="page">
      <div className="mb-3">
        <Link to="/sessions" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>← Minhas Sessões</Link>
      </div>

      <div className="page-header">
        <div>
          <h1>{session.name}</h1>
          {session.description && <p className="text-muted text-sm mt-1">{session.description}</p>}
        </div>
        <span className={`badge ${session.is_finalized ? 'badge-green' : 'badge-yellow'}`} style={{ fontSize: '0.9rem', padding: '0.35rem 0.9rem' }}>
          {session.is_finalized ? 'Finalizada' : 'Em andamento'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
        <div className="card">
          <strong className="mb-3" style={{ display: 'block' }}>Participantes</strong>
          {session.participants.map(p => (
            <div key={p.id} className="flex justify-between items-center mb-2">
              <span>{p.name}</span>
              <span className="badge badge-purple">Nível {p.level}</span>
            </div>
          ))}
        </div>

        {session.is_finalized && (
          <div className="card">
            <strong className="mb-3" style={{ display: 'block' }}>XP Recebido</strong>
            {session.xp_records.map(r => (
              <div key={r.id} className="flex justify-between items-center mb-2">
                <span>{r.character_name}</span>
                <span className="text-success font-bold">+{r.xp_granted.toLocaleString('pt-BR')} XP</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {myActions.length > 0 && (
        <div className="card mt-3">
          <strong className="mb-3" style={{ display: 'block' }}>Ações dos meus personagens</strong>
          <table>
            <thead>
              <tr>
                <th>Personagem</th>
                <th>Ação</th>
                <th>Qtd</th>
                <th>XP</th>
              </tr>
            </thead>
            <tbody>
              {myActions.map((a, i) => (
                <tr key={i}>
                  <td>{a.character_name}</td>
                  <td>{a.item_name}</td>
                  <td>{a.quantity}</td>
                  <td>{(a.xp_value * a.quantity).toLocaleString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
