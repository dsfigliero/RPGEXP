import { useEffect, useState } from 'react'
import api from '../../api'

export default function Feats() {
  const [feats, setFeats] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const { data } = await api.get('/feats')
    setFeats(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreate() { setModal({ name: '', description: '' }); setError('') }
  function openEdit(f) { setModal({ id: f.id, name: f.name, description: f.description }); setError('') }

  async function save() {
    if (!modal.name.trim()) return setError('Nome obrigatório')
    setSaving(true)
    try {
      if (modal.id) await api.put(`/feats/${modal.id}`, modal)
      else await api.post('/feats', modal)
      setModal(null)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  async function del(id) {
    if (!confirm('Excluir talento?')) return
    await api.delete(`/feats/${id}`)
    load()
  }

  if (loading) return <div className="page"><div className="spinner" /></div>

  return (
    <div className="page">
      <div className="page-header">
        <h1>Talentos</h1>
        <button className="btn-primary" onClick={openCreate}>+ Novo Talento</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {feats.map(f => (
          <div key={f.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <span style={{ fontWeight: 600 }}>{f.name}</span>
              {f.description && <div className="text-muted text-sm">{f.description}</div>}
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost btn-sm" onClick={() => openEdit(f)}>Editar</button>
              <button className="btn-danger btn-sm" onClick={() => del(f.id)}>Excluir</button>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h2>{modal.id ? 'Editar' : 'Novo'} Talento</h2>
              <button className="btn-ghost btn-sm" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="form-group">
              <label>Nome</label>
              <input value={modal.name} onChange={e => setModal(m => ({ ...m, name: e.target.value }))} autoFocus />
            </div>
            <div className="form-group">
              <label>Efeito / Descrição</label>
              <input value={modal.description} onChange={e => setModal(m => ({ ...m, description: e.target.value }))} placeholder="Ex: +4 na iniciativa" />
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
