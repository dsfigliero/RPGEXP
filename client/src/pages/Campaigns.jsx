import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../AuthContext'

export default function Campaigns() {
  const { user } = useAuth()
  const [campaigns, setCampaigns] = useState([])
  const [discover, setDiscover] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const [c, d] = await Promise.all([
      api.get('/campaigns'),
      api.get('/campaigns/discover')
    ])
    setCampaigns(c.data)
    setDiscover(d.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setModal({ name: '', description: '', is_public: 0 })
    setError('')
  }

  async function save() {
    if (!modal.name.trim()) return setError('Nome obrigatório')
    setSaving(true)
    try {
      await api.post('/campaigns', { name: modal.name, description: modal.description, is_public: modal.is_public })
      setModal(null)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function requestJoin(campaignId) {
    try {
      await api.post(`/campaigns/${campaignId}/request-join`)
      load()
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao solicitar entrada')
    }
  }

  if (loading) return <div className="page"><div className="spinner" /></div>

  return (
    <div className="page">
      <div className="page-header">
        <h1>Campanhas</h1>
        <button className="btn-primary" onClick={openCreate}>+ Nova Campanha</button>
      </div>

      <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-muted)' }}>Minhas Campanhas</h2>

      {campaigns.length === 0
        ? <div className="card text-muted text-sm">Você ainda não participa de nenhuma campanha.</div>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            {campaigns.map(c => {
              const isMestre = c.created_by === user?.id
              const isAdmin = user?.is_admin
              const to = isAdmin ? `/admin/campaigns/${c.id}` : `/campaigns/${c.id}`
              return (
                <div key={c.id} className="card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 600 }}>{c.name}</span>
                    {isAdmin && <span className="badge" style={{ background: 'var(--primary)', color: '#fff' }}>Admin</span>}
                    {!isAdmin && isMestre && <span className="badge badge-purple">Mestre</span>}
                    {!isAdmin && !isMestre && <span className="badge badge-green">Jogador</span>}
                    {(isAdmin || isMestre) && c.pending_requests > 0 && (
                      <span style={{ background: 'var(--danger)', color: '#fff', borderRadius: '99px', fontSize: '0.7rem', padding: '0.1rem 0.4rem', marginLeft: '0.4rem' }}>
                        {c.pending_requests}
                      </span>
                    )}
                  </div>
                  {c.description && <p className="text-muted text-sm" style={{ marginBottom: '0.5rem' }}>{c.description}</p>}
                  {c.mestre_email && <p className="text-muted text-sm" style={{ marginBottom: '0.5rem' }}>Mestre: {c.mestre_email}</p>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <span className="badge badge-purple">{c.session_count} {c.session_count === 1 ? 'sessão' : 'sessões'}</span>
                    <Link to={to} style={{ fontSize: '0.85rem', marginLeft: 'auto' }}>
                      {(isAdmin || isMestre) ? 'Gerenciar →' : 'Ver →'}
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      {discover.length > 0 && (
        <>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-muted)' }}>Descobrir Campanhas</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {discover.map(c => (
              <div key={c.id} className="card">
                <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{c.name}</div>
                {c.description && <p className="text-muted text-sm" style={{ marginBottom: '0.5rem' }}>{c.description}</p>}
                {c.mestre_email && <p className="text-muted text-sm" style={{ marginBottom: '0.25rem' }}>Mestre: {c.mestre_email}</p>}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <span className="badge badge-purple">{c.session_count} {c.session_count === 1 ? 'sessão' : 'sessões'}</span>
                  {c.my_request === null && (
                    <button className="btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => requestJoin(c.id)}>
                      Solicitar entrada
                    </button>
                  )}
                  {c.my_request === 'pending' && (
                    <span className="badge badge-yellow" style={{ marginLeft: 'auto' }}>Aguardando aprovação</span>
                  )}
                  {c.my_request === 'rejected' && (
                    <span className="badge" style={{ marginLeft: 'auto', background: '#fde8e8', color: '#c0392b' }}>Não aprovado</span>
                  )}
                  {c.my_request === 'approved' && (
                    <span className="badge badge-green" style={{ marginLeft: 'auto' }}>Aprovado</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {modal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <h2>Nova Campanha</h2>
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
              <label>Visibilidade</label>
              <select value={modal.is_public} onChange={e => setModal(m => ({ ...m, is_public: Number(e.target.value) }))}>
                <option value={0}>Privada</option>
                <option value={1}>Pública</option>
              </select>
            </div>
            {error && <p className="error-msg">{error}</p>}
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
