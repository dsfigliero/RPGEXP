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
          {session.campaign_name && <p className="text-muted text-sm mt-1">Campanha: {session.campaign_name}</p>}
          {session.description && <p className="text-muted text-sm mt-1">{session.description}</p>}
        </div>
        <div className="flex gap-2 items-center" style={{ flexWrap: 'wrap' }}>
          <span className={`badge ${session.is_finalized ? 'badge-green' : 'badge-yellow'}`} style={{ fontSize: '0.9rem', padding: '0.35rem 0.9rem' }}>
            {session.is_finalized ? 'Finalizada' : 'Em andamento'}
          </span>
          {!session.is_finalized && (user?.is_admin || user?.id === session.campaign_created_by) && (
            <Link to={`/dashboard/${id}`} className="btn-ghost btn-sm">🎲 Dashboard</Link>
          )}
          {!session.is_finalized && (
            <Link to={`/sessions/${id}/live`} className="btn-primary btn-sm">🔴 Ao Vivo</Link>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
        <div className="card">
          <strong style={{ display: 'block', marginBottom: '0.75rem' }}>Participantes ({session.participants.length})</strong>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.5rem', marginTop: '0.5rem' }}>
            {session.participants.map(p => {
              const hpPct = p.max_hp > 0 ? Math.min(100, Math.max(0, (p.hp / p.max_hp) * 100)) : null
              const hpColor = !hpPct ? 'var(--text-muted)' : hpPct > 50 ? 'var(--success)' : hpPct > 25 ? 'var(--warning)' : 'var(--danger)'
              return (
                <div key={p.id} style={{ background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: '0.6rem 0.75rem', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.2rem' }}>{p.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                    {p.class ? `${p.class} · ` : ''}Nível {p.level}
                  </div>
                  {p.max_hp > 0 && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                        <span>HP</span>
                        <span style={{ color: hpColor, fontWeight: 600 }}>{p.hp}/{p.max_hp}</span>
                      </div>
                      <div style={{ background: 'var(--border)', borderRadius: 4, height: 4 }}>
                        <div style={{ width: `${hpPct}%`, background: hpColor, borderRadius: 4, height: '100%', transition: 'width 0.3s' }} />
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
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

      {session.is_finalized && myXP.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))', gap: '1rem', marginTop: '1rem' }}>
          {myXP.map(r => (
            <div key={r.id} className="card" style={{ textAlign: 'center' }}>
              <div className="text-muted text-sm">{r.character_name}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)', margin: '0.5rem 0' }}>
                +{r.xp_granted.toLocaleString('pt-BR')}
              </div>
              <div className="text-muted text-sm">XP recebido</div>
            </div>
          ))}
        </div>
      )}

      {myActions.length > 0 && (
        <div className="card mt-3">
          <strong className="mb-3" style={{ display: 'block' }}>Ações dos meus personagens</strong>
          <table>
            <thead>
              <tr>
                <th>Personagem</th>
                <th>Ação</th>
                <th>XP Unit.</th>
                <th>Qtd</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {myActions.map((a, i) => (
                <tr key={i}>
                  <td>{a.character_name}</td>
                  <td>{a.item_name}</td>
                  <td>{a.xp_value.toLocaleString('pt-BR')}</td>
                  <td>{a.quantity}</td>
                  <td className="font-bold">{(a.xp_value * a.quantity).toLocaleString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} style={{ textAlign: 'right', fontWeight: 600 }}>Total</td>
                <td className="font-bold">{myActions.reduce((s, a) => s + a.xp_value * a.quantity, 0).toLocaleString('pt-BR')}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
