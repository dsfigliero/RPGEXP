import { useEffect, useState } from 'react'
import api from '../api'

export default function Characters() {
  const [characters, setCharacters] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | { id?, name, level }
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const { data } = await api.get('/characters')
    setCharacters(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreate() { setModal({ name: '', level: 1 }); setError('') }
  function openEdit(c) { setModal({ id: c.id, name: c.name, level: c.level }); setError('') }

  async function save() {
    if (!modal.name.trim()) return setError('Nome obrigatório')
    setSaving(true)
    try {
      if (modal.id)
        await api.put(`/characters/${modal.id}`, { name: modal.name, level: modal.level })
      else
        await api.post('/characters', { name: modal.name, level: modal.level })
      setModal(null)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function del(id) {
    if (!confirm('Excluir personagem?')) return
    await api.delete(`/characters/${id}`)
    load()
  }

  if (loading) return <div className="page"><div className="spinner" /></div>

  return (
    <div className="page">
      <div className="page-header">
        <h1>Meus Personagens</h1>
        <button className="btn-primary" onClick={openCreate}>+ Adicionar</button>
      </div>

      {characters.length === 0
        ? <div className="card text-muted text-sm">Nenhum personagem cadastrado ainda.</div>
        : (
          <div className="card" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Nível</th>
                  <th>XP Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {characters.map(c => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td><span className="badge badge-purple">Nível {c.level}</span></td>
                    <td>{c.total_xp.toLocaleString('pt-BR')} XP</td>
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
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <h2>{modal.id ? 'Editar' : 'Adicionar'} Personagem</h2>
              <button className="btn-ghost btn-sm" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="form-group">
              <label>Nome</label>
              <input value={modal.name} onChange={e => setModal(m => ({ ...m, name: e.target.value }))} autoFocus />
            </div>
            <div className="form-group">
              <label>Nível</label>
              <input type="number" min={1} value={modal.level} onChange={e => setModal(m => ({ ...m, level: +e.target.value }))} />
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
