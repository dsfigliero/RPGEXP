import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api'

export default function AdminCampaigns() {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const { data } = await api.get('/campaigns')
    setCampaigns(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreate() { setModal({ name: '', description: '', is_public: 0 }); setError('') }
  function openEdit(c) { setModal({ id: c.id, name: c.name, description: c.description, is_public: c.is_public }); setError('') }

  async function save() {
    if (!modal.name.trim()) return setError('Nome obrigatório')
    setSaving(true)
    try {
      if (modal.id)
        await api.put(`/campaigns/${modal.id}`, { name: modal.name, description: modal.description, is_public: modal.is_public })
      else
        await api.post('/campaigns', { name: modal.name, description: modal.description, is_public: modal.is_public })
      setModal(null)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function del(id) {
    if (!confirm('Excluir campanha?')) return
    await api.delete(`/campaigns/${id}`)
    load()
  }

  if (loading) return <div className="page"><div className="spinner" /></div>

  return (
    <div className="page">
      <div className="page-header">
        <h1>Campanhas</h1>
        <button className="btn-primary" onClick={openCreate}>+ Nova Campanha</button>
      </div>

      {campaigns.length === 0
        ? <div className="card text-muted text-sm">Nenhuma campanha criada.</div>
        : (
          <div className="card" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Descrição</th>
                  <th>Visibilidade</th>
                  <th>Sessões</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map(c => (
                  <tr key={c.id}>
                    <td>
                      <Link to={`/admin/campaigns/${c.id}`} style={{ fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>
                        {c.name}
                      </Link>
                    </td>
                    <td className="text-muted">{c.description || '—'}</td>
                    <td>
                      {c.is_public
                        ? <span className="badge badge-green">Pública</span>
                        : <span className="badge badge-yellow">Privada</span>
                      }
                    </td>
                    <td><span className="badge badge-purple">{c.session_count}</span></td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn-ghost btn-sm" onClick={() => openEdit(c)}>Editar</button>
                        <button className="btn-danger btn-sm" onClick={() => del(c.id)}>Excluir</button>
                      </div>
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
              <h2>{modal.id ? 'Editar' : 'Nova'} Campanha</h2>
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
