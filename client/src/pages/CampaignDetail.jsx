import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../AuthContext'

export default function CampaignDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const [campaign, setCampaign] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [editModal, setEditModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const { data } = await api.get(`/campaigns/${id}`)
    setCampaign(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  const isMestre = campaign?.created_by === user?.id
  const isAdmin = user?.is_admin

  function openNewSession() {
    setModal({ name: '', description: '', campaign_id: id })
    setError('')
  }

  async function saveSession() {
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

  function openEdit() {
    setEditModal({ name: campaign.name, description: campaign.description, is_public: campaign.is_public })
    setError('')
  }

  async function saveEdit() {
    if (!editModal.name.trim()) return setError('Nome obrigatório')
    setSaving(true)
    try {
      await api.put(`/campaigns/${id}`, { name: editModal.name, description: editModal.description, is_public: editModal.is_public })
      setEditModal(null)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar')
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

  const canManage = isAdmin || isMestre

  return (
    <div className="page">
      <div className="mb-3">
        <Link to="/campaigns" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>← Campanhas</Link>
      </div>

      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h1>{campaign.name}</h1>
            {isAdmin && <span className="badge" style={{ background: 'var(--primary)', color: '#fff' }}>Admin</span>}
            {!isAdmin && isMestre && <span className="badge badge-purple">Mestre</span>}
            {!isAdmin && !isMestre && <span className="badge badge-green">Jogador</span>}
            <span className={`badge ${campaign.is_public ? 'badge-green' : 'badge-yellow'}`}>
              {campaign.is_public ? 'Pública' : 'Privada'}
            </span>
          </div>
          {campaign.description && <p className="text-muted text-sm mt-1">{campaign.description}</p>}
          {campaign.mestre_email && <p className="text-muted text-sm">Mestre: {campaign.mestre_email}</p>}
        </div>
        {canManage && (
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={openEdit}>Editar</button>
            <button className="btn-primary" onClick={openNewSession}>+ Nova Sessão</button>
          </div>
        )}
      </div>

      {campaign.sessions.length === 0
        ? <div className="card text-muted text-sm">Nenhuma sessão nesta campanha ainda.</div>
        : (
          <div className="card" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Sessão</th>
                  <th>Data</th>
                  {canManage && <th>Participantes</th>}
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {campaign.sessions.map(s => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{new Date(s.date).toLocaleDateString('pt-BR')}</td>
                    {canManage && <td>{s.participant_count}</td>}
                    <td>
                      <span className={`badge ${s.is_finalized ? 'badge-green' : 'badge-yellow'}`}>
                        {s.is_finalized ? 'Finalizada' : 'Em andamento'}
                      </span>
                    </td>
                    <td>
                      {canManage
                        ? <Link to={`/admin/sessions/${s.id}`} className="btn-ghost btn-sm" style={{ display: 'inline-block' }}>Gerenciar →</Link>
                        : <Link to={`/sessions/${s.id}`} style={{ fontSize: '0.85rem' }}>Ver detalhes →</Link>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {canManage && campaign.join_requests && campaign.join_requests.length > 0 && (
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
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setModal(null)}>
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
              <button className="btn-primary" onClick={saveSession} disabled={saving}>{saving ? 'Criando...' : 'Criar'}</button>
            </div>
          </div>
        </div>
      )}

      {editModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setEditModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <h2>Editar Campanha</h2>
              <button className="btn-ghost btn-sm" onClick={() => setEditModal(null)}>✕</button>
            </div>
            <div className="form-group">
              <label>Nome</label>
              <input value={editModal.name} onChange={e => setEditModal(m => ({ ...m, name: e.target.value }))} autoFocus />
            </div>
            <div className="form-group">
              <label>Descrição</label>
              <textarea rows={3} value={editModal.description} onChange={e => setEditModal(m => ({ ...m, description: e.target.value }))} style={{ resize: 'vertical' }} />
            </div>
            <div className="form-group">
              <label>Visibilidade</label>
              <select value={editModal.is_public} onChange={e => setEditModal(m => ({ ...m, is_public: Number(e.target.value) }))}>
                <option value={0}>Privada</option>
                <option value={1}>Pública</option>
              </select>
            </div>
            {error && <p className="error-msg">{error}</p>}
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setEditModal(null)}>Cancelar</button>
              <button className="btn-primary" onClick={saveEdit} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
