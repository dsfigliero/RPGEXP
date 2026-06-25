import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../AuthContext'

function HpBar({ hp, maxHp }) {
  if (!maxHp) return null;
  const pct = Math.min(100, Math.max(0, (hp / maxHp) * 100));
  const color = pct > 50 ? 'var(--success)' : pct > 25 ? 'var(--warning)' : 'var(--danger)';
  return (
    <div style={{ background: 'var(--border)', borderRadius: 4, height: 8, margin: '0.25rem 0' }}>
      <div style={{ width: `${pct}%`, background: color, borderRadius: 4, height: '100%', transition: 'width 0.3s' }} />
    </div>
  );
}

export default function SessionLive() {
  const { id } = useParams()
  const { user } = useAuth()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [initInputs, setInitInputs] = useState({})
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    try {
      const r = await api.get(`/sessions/${id}`)
      setSession(r.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [id])

  async function submitInitiative(charId) {
    const val = initInputs[charId]
    if (val === undefined || val === '') return
    setSubmitting(true)
    try {
      await api.post(`/sessions/${id}/my-initiative`, { initiative: Number(val) })
      load()
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="page"><div className="spinner" /></div>
  if (!session) return <div className="page"><p className="text-muted">Sessão não encontrada.</p></div>

  const myChars = session.participants.filter(p => p.user_id === user?.id)
  const others = session.participants.filter(p => p.user_id !== user?.id)

  return (
    <div className="page">
      <div className="mb-3">
        <Link to="/sessions" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>← Minhas Sessões</Link>
      </div>

      <div className="page-header">
        <div>
          <h1>{session.name}</h1>
          {session.campaign_name && <p className="text-muted text-sm">{session.campaign_name}</p>}
        </div>
        <div className="flex gap-2 items-center">
          <span className="badge badge-green" style={{ fontSize: '0.9rem', padding: '0.35rem 0.9rem' }}>🔴 Ao Vivo</span>
          <button className="btn-ghost btn-sm" onClick={load}>↻ Atualizar</button>
        </div>
      </div>

      {myChars.length === 0 && (
        <div className="card text-muted text-sm">Você não tem personagens nesta sessão.</div>
      )}

      {myChars.map(char => (
        <div key={char.id} className="card" style={{ marginBottom: '1rem', borderLeft: '4px solid var(--primary)' }}>
          <div className="page-header" style={{ marginBottom: '0.75rem' }}>
            <div>
              <h2 style={{ margin: 0 }}>{char.name}</h2>
              <p className="text-muted text-sm">{char.class || ''}{char.class ? ' • ' : ''}Nível {char.level}</p>
            </div>
            <Link to={`/characters/${char.id}`} className="btn-ghost btn-sm">Ver Ficha</Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px,1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
            <div className="card" style={{ textAlign: 'center', padding: '0.5rem' }}>
              <div className="text-muted text-sm">HP</div>
              <div style={{ fontWeight: 700 }}>{char.hp}/{char.max_hp}</div>
              <HpBar hp={char.hp} maxHp={char.max_hp} />
            </div>
            <div className="card" style={{ textAlign: 'center', padding: '0.5rem' }}>
              <div className="text-muted text-sm">CA</div>
              <div style={{ fontWeight: 700 }}>{char.ac}</div>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: '0.5rem' }}>
              <div className="text-muted text-sm">XP</div>
              <div style={{ fontWeight: 700 }}>{char.total_xp.toLocaleString('pt-BR')}</div>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: '0.5rem' }}>
              <div className="text-muted text-sm">Iniciativa</div>
              <div style={{ fontWeight: 700 }}>{char.initiative || 0}</div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
            <p className="text-muted text-sm" style={{ marginBottom: '0.5rem' }}>Informe sua iniciativa</p>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="number"
                placeholder="Ex: 14"
                value={initInputs[char.id] ?? ''}
                onChange={e => setInitInputs(v => ({ ...v, [char.id]: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') submitInitiative(char.id) }}
                style={{ width: 90, fontSize: '1rem', padding: '0.4rem 0.6rem' }}
              />
              <button
                className="btn-primary"
                onClick={() => submitInitiative(char.id)}
                disabled={submitting || initInputs[char.id] === undefined || initInputs[char.id] === ''}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      ))}

      {others.length > 0 && (
        <>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '1.5rem 0 0.75rem' }}>Outros Participantes</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))', gap: '0.75rem' }}>
            {others.map(p => (
              <div key={p.id} className="card" style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 600 }}>⚔️ {p.name}</div>
                <div className="text-muted text-sm">{p.class ? `${p.class} • ` : ''}Nv {p.level}</div>
                {p.initiative > 0 && (
                  <div className="text-muted text-sm" style={{ marginTop: '0.25rem' }}>
                    Inic: <strong>{p.initiative}</strong>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
