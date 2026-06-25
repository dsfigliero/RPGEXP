import { useEffect, useState } from 'react'
import api from '../../api'

export default function Classes() {
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const { data } = await api.get('/classes')
    setClasses(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setModal({ name: '', description: '', uses_magic: 0 })
    setError('')
  }

  function openEdit(c) {
    setModal({ id: c.id, name: c.name, description: c.description, uses_magic: c.uses_magic })
    setError('')
  }

  async function save() {
    if (!modal.name.trim()) return setError('Nome obrigatório')
    setSaving(true)
    try {
      if (modal.id) await api.put(`/classes/${modal.id}`, modal)
      else await api.post('/classes', modal)
      setModal(null)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  async function del(id) {
    if (!confirm('Excluir classe?')) return
    await api.delete(`/classes/${id}`)
    load()
  }

  if (loading) return <div className="page"><div className="spinner" /></div>

  return (
    <div className="page">
      <div className="page-header">
        <h1>Classes de Personagem</h1>
        <button className="btn-primary" onClick={openCreate}>+ Nova Classe</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {classes.map(c => (
          <div key={c.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <span style={{ fontWeight: 600 }}>{c.name}</span>
              {c.uses_magic ? <span className="badge badge-purple" style={{ marginLeft: '0.5rem' }}>✨ Usa Magia</span> : <span className="badge" style={{ marginLeft: '0.5rem', background: 'var(--surface2)' }}>Sem Magia</span>}
              {c.description && <div className="text-muted text-sm">{c.description}</div>}
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost btn-sm" onClick={() => openEdit(c)}>Editar</button>
              <button className="btn-danger btn-sm" onClick={() => del(c.id)}>Excluir</button>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h2>{modal.id ? 'Editar' : 'Nova'} Classe</h2>
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
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={!!modal.uses_magic} onChange={e => setModal(m => ({ ...m, uses_magic: e.target.checked ? 1 : 0 }))} />
                <span>Usuária de Magia</span>
              </label>
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
