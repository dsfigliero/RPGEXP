import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../../api'


export default function AdminSessionDetail() {
  const { id } = useParams()
  const [session, setSession] = useState(null)
  const [allChars, setAllChars] = useState([])
  const [evalItems, setEvalItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState({ character_id: '', evaluation_item_id: '', quantity: 1 })
  const [finalizing, setFinalizing] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const [s, chars, items] = await Promise.all([
      api.get(`/sessions/${id}`),
      api.get('/sessions/admin/all-characters'),
      api.get('/evaluation-items')
    ])
    setSession(s.data)
    setAllChars(chars.data)
    setEvalItems(items.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function addParticipant(characterId) {
    await api.post(`/sessions/${id}/participants`, { character_id: characterId })
    load()
  }

  async function addAllParticipants() {
    await api.post(`/sessions/${id}/participants/all`)
    load()
  }

  async function removeParticipant(characterId) {
    await api.delete(`/sessions/${id}/participants/${characterId}`)
    load()
  }

  async function addAction() {
    if (!action.character_id || !action.evaluation_item_id) return setError('Selecione personagem e item')
    setError('')
    await api.post(`/sessions/${id}/actions`, action)
    setAction({ character_id: '', evaluation_item_id: '', quantity: 1 })
    load()
  }

  async function removeAction(character_id, evaluation_item_id) {
    await api.delete(`/sessions/${id}/actions`, { data: { character_id, evaluation_item_id } })
    load()
  }

  async function finalize() {
    if (!confirm('Finalizar sessão e distribuir XP? Esta ação não pode ser desfeita.')) return
    setFinalizing(true)
    try {
      await api.post(`/sessions/${id}/finalize`)
      load()
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao finalizar')
    } finally {
      setFinalizing(false)
    }
  }

  if (loading) return <div className="page"><div className="spinner" /></div>
  if (!session) return <div className="page"><p>Sessão não encontrada.</p></div>

  const participantIds = new Set(session.participants.map(p => p.id))
  const availableChars = allChars.filter(c => !participantIds.has(c.id))
  const totalXP = session.actions.reduce((s, a) => s + a.xp_value * a.quantity, 0)

  return (
    <div className="page">
      <div className="mb-3">
        <Link
          to={session.campaign_id ? `/admin/campaigns/${session.campaign_id}` : '/admin/sessions'}
          style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}
        >
          ← {session.campaign_name || 'Sessões'}
        </Link>
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
          {!session.is_finalized && (
            <Link to={`/dashboard/${id}`} className="btn-ghost btn-sm">🎲 Dashboard</Link>
          )}
          {!session.is_finalized && (
            <button className="btn-primary" onClick={finalize} disabled={finalizing}>
              {finalizing ? 'Finalizando...' : '⚡ Finalizar Sessão'}
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
        {/* Participantes */}
        <div className="card">
          <strong className="mb-3" style={{ display: 'block' }}>Participantes</strong>
          <div className="flex" style={{ flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {session.participants.map(p => (
              <span key={p.id} className="chip">
                {p.name} (Nv {p.level})
                {!session.is_finalized && (
                  <button onClick={() => removeParticipant(p.id)} title="Remover">✕</button>
                )}
              </span>
            ))}
            {session.participants.length === 0 && <span className="text-muted text-sm">Nenhum participante.</span>}
          </div>
          {!session.is_finalized && availableChars.length > 0 && (
            <div className="flex gap-2" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <select onChange={e => { if (e.target.value) { addParticipant(e.target.value); e.target.value = '' } }} defaultValue="">
                <option value="">+ Adicionar personagem...</option>
                {availableChars.map(c => (
                  <option key={c.id} value={c.id}>{c.name} (Nv {c.level}) — {c.user_email}</option>
                ))}
              </select>
              <button className="btn-ghost btn-sm" onClick={addAllParticipants}>+ Adicionar Todos</button>
            </div>
          )}
        </div>

        {/* Registrar Ação */}
        {!session.is_finalized && (
          <div className="card">
            <strong className="mb-3" style={{ display: 'block' }}>Registrar Ação</strong>
            <div className="form-group">
              <label>Personagem</label>
              <select value={action.character_id} onChange={e => setAction(a => ({ ...a, character_id: e.target.value }))}>
                <option value="">Selecione...</option>
                {session.participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Item de Avaliação</label>
              <select value={action.evaluation_item_id} onChange={e => setAction(a => ({ ...a, evaluation_item_id: e.target.value }))}>
                <option value="">Selecione...</option>
                {evalItems.map(i => <option key={i.id} value={i.id}>{i.name} ({i.xp_value.toLocaleString('pt-BR')} XP)</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Quantidade</label>
              <input type="number" min={1} value={action.quantity} onChange={e => setAction(a => ({ ...a, quantity: +e.target.value }))} />
            </div>
            {error && <p className="error-msg">{error}</p>}
            <button className="btn-primary w-full" onClick={addAction}>Registrar</button>
          </div>
        )}
      </div>

      {/* Ações registradas */}
      <div className="card" style={{ padding: 0 }}>
        <div className="flex justify-between items-center" style={{ padding: '1rem 1.25rem 0.75rem' }}>
          <strong>Ações Registradas</strong>
          <span className="badge badge-purple">Total: {totalXP.toLocaleString('pt-BR')} XP</span>
        </div>
        {session.actions.length === 0
          ? <p className="text-muted text-sm" style={{ padding: '0.75rem 1.25rem 1rem' }}>Nenhuma ação registrada.</p>
          : (
            <table>
              <thead>
                <tr>
                  <th>Personagem</th>
                  <th>Ação</th>
                  <th>Qtd</th>
                  <th>XP</th>
                  {!session.is_finalized && <th></th>}
                </tr>
              </thead>
              <tbody>
                {session.actions.map((a, i) => (
                  <tr key={i}>
                    <td>{a.character_name}</td>
                    <td>{a.item_name}</td>
                    <td>{a.quantity}</td>
                    <td>{(a.xp_value * a.quantity).toLocaleString('pt-BR')}</td>
                    {!session.is_finalized && (
                      <td><button className="btn-danger btn-sm" onClick={() => removeAction(a.character_id, a.evaluation_item_id)}>✕</button></td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>

      {/* XP Records após finalização */}
      {session.is_finalized && session.xp_records.length > 0 && (
        <div className="card mt-3">
          <strong className="mb-3" style={{ display: 'block' }}>XP Distribuído</strong>
          <table>
            <thead>
              <tr><th>Personagem</th><th>XP Recebido</th></tr>
            </thead>
            <tbody>
              {session.xp_records.map(r => (
                <tr key={r.id}>
                  <td>{r.character_name}</td>
                  <td className="text-success font-bold">+{r.xp_granted.toLocaleString('pt-BR')} XP</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
