import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api'

export default function AdminSessions() {
  const [sessions, setSessions] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const [s, c] = await Promise.all([api.get('/sessions'), api.get('/campaigns')])
    setSessions(s.data)
    setCampaigns(c.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreate() { setModal({ name: '', description: '', campaign_id: '' }); setError('') }

  async function save() {
    if (!modal.name.trim()) return setError('Nome obrigatório')
    setSaving(true)
    try {
      await api.post('/sessions', { ...modal, campaign_id: modal.campaign_id || null })
      setModal(null)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao criar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="page"><div className="spinner" /></div>

  return (
    <div className="page">
      <div className="page-header">
        <h1>Sessões</h1>
        <button className="btn-primary" onClick={openCreate}>+ Nova Sessão</button>
      </div>

      {sessions.length === 0
        ? <div className="card text-muted text-sm">Nenhuma sessão criada.</div>
        : (
          <div className="card" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
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
                    <td>
                      <Link to={`/admin/sessions/${s.id}`} className="btn-ghost btn-sm" style={{ display: 'inline-block' }}>
                        Gerenciar →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {modal && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h2>Nova Sessão</h2>
              <button className="btn-ghost btn-sm" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="form-group">
              <label>Nome</label>
              <input value={modal.name} onChange={e => setModal(m => ({ ...m, name: e.target.value }))} autoFocus />
            </div>
            <div className="form-group">
              <label>Descrição</label>
              <textarea rows={3} value={modal.description} onChange={e => setModal(m => ({ ...m, description: e.target.value }))} style={{ resize: 'vertical' }} />
            </div>
            <div className="form-group">
              <label>Campanha</label>
              <select value={modal.campaign_id} onChange={e => setModal(m => ({ ...m, campaign_id: e.target.value }))}>
                <option value="">— Sem campanha —</option>
                {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {error && <p className="error-msg">{error}</p>}
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Criando...' : 'Criar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
