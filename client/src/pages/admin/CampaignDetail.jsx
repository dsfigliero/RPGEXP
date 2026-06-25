import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../../api'

export default function AdminCampaignDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [campaign, setCampaign] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const { data } = await api.get(`/campaigns/${id}`)
    setCampaign(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  function openNewSession() {
    setModal({ name: '', description: '', campaign_id: id })
    setError('')
  }

  async function save() {
    if (!modal.name.trim()) return setError('Nome obrigatório')
    setSaving(true)
    try {
      await api.post('/sessions', { name: modal.name, description: modal.description, campaign_id: modal.campaign_id })
      setModal(null)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao criar')
    } finally {
      setSaving(false)
    }
  }

  async function handleJoinRequest(requestId, status) {
    try {
      await api.put(`/campaigns/${id}/join-requests/${requestId}`, { status })
      load()
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao processar solicitação')
    }
  }

  if (loading) return <div className="page"><div className="spinner" /></div>
  if (!campaign) return <div className="page"><p className="text-muted">Campanha não encontrada.</p></div>

  return (
    <div className="page">
      <div className="mb-3">
        <Link to="/admin/campaigns" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>← Campanhas</Link>
      </div>

      <div className="page-header">
        <div>
          <h1>{campaign.name}</h1>
          {campaign.description && <p className="text-muted text-sm mt-1">{campaign.description}</p>}
        </div>
        <button className="btn-primary" onClick={openNewSession}>+ Nova Sessão</button>
      </div>

      {campaign.sessions.length === 0
        ? <div className="card text-muted text-sm">Nenhuma sessão nesta campanha.</div>
        : (
          <div className="card" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Data</th>
                  <th>Participantes</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {campaign.sessions.map(s => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{new Date(s.date).toLocaleDateString('pt-BR')}</td>
                    <td>{s.participant_count}</td>
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

      {campaign.join_requests && campaign.join_requests.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Solicitações de Entrada</h2>
          <div className="card" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {campaign.join_requests.map(r => (
                  <tr key={r.id}>
                    <td>{r.user_email}</td>
                    <td>
                      {r.status === 'pending' && <span className="badge badge-yellow">Pendente</span>}
                      {r.status === 'approved' && <span className="badge badge-green">Aprovado</span>}
                      {r.status === 'rejected' && <span className="badge" style={{ background: '#fde8e8', color: '#c0392b' }}>Rejeitado</span>}
                    </td>
                    <td>
                      {r.status === 'pending' && (
                        <div className="flex gap-2">
                          <button className="btn-primary btn-sm" onClick={() => handleJoinRequest(r.id, 'approved')}>Aprovar</button>
                          <button className="btn-danger btn-sm" onClick={() => handleJoinRequest(r.id, 'rejected')}>Rejeitar</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
