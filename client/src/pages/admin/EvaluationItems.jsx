import { useEffect, useState } from 'react'
import api from '../../api'

export default function EvaluationItems() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const { data } = await api.get('/evaluation-items')
    setItems(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreate() { setModal({ name: '', description: '', xp_value: 100 }); setError('') }
  function openEdit(i) { setModal({ ...i }); setError('') }

  async function save() {
    if (!modal.name.trim() || !modal.xp_value) return setError('Nome e XP obrigatórios')
    setSaving(true)
    try {
      if (modal.id)
        await api.put(`/evaluation-items/${modal.id}`, modal)
      else
        await api.post('/evaluation-items', modal)
      setModal(null)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function del(id) {
    if (!confirm('Excluir item?')) return
    await api.delete(`/evaluation-items/${id}`)
    load()
  }

  if (loading) return <div className="page"><div className="spinner" /></div>

  return (
    <div className="page">
      <div className="page-header">
        <h1>Itens de Avaliação</h1>
        <button className="btn-primary" onClick={openCreate}>+ Adicionar</button>
      </div>

      {items.length === 0
        ? <div className="card text-muted text-sm">Nenhum item cadastrado.</div>
        : (
          <div className="card" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Descrição</th>
                  <th>XP</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map(i => (
                  <tr key={i.id}>
                    <td>{i.name}</td>
                    <td className="text-muted">{i.description || '—'}</td>
                    <td><span className="badge badge-purple">{i.xp_value.toLocaleString('pt-BR')}</span></td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn-ghost btn-sm" onClick={() => openEdit(i)}>Editar</button>
                        <button className="btn-danger btn-sm" onClick={() => del(i.id)}>Excluir</button>
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
              <h2>{modal.id ? 'Editar' : 'Novo'} Item</h2>
              <button className="btn-ghost btn-sm" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="form-group">
              <label>Nome</label>
              <input value={modal.name} onChange={e => setModal(m => ({ ...m, name: e.target.value }))} autoFocus />
            </div>
            <div className="form-group">
              <label>Descrição</label>
              <input value={modal.description} onChange={e => setModal(m => ({ ...m, description: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Valor em XP</label>
              <input type="number" min={1} value={modal.xp_value} onChange={e => setModal(m => ({ ...m, xp_value: +e.target.value }))} />
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
