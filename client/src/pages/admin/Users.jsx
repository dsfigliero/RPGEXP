import { useEffect, useState } from 'react'
import { useAuth } from '../../AuthContext'
import api from '../../api'

export default function Users() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data } = await api.get('/users')
    setUsers(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function toggleAdmin(id) {
    await api.put(`/users/${id}/toggle-admin`)
    load()
  }

  async function del(id) {
    if (!confirm('Excluir usuário e todos seus dados?')) return
    await api.delete(`/users/${id}`)
    load()
  }

  if (loading) return <div className="page"><div className="spinner" /></div>

  return (
    <div className="page">
      <div className="page-header">
        <h1>Usuários</h1>
        <span className="text-muted text-sm">{users.length} cadastrado(s)</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {users.map(u => (
          <div key={u.id} className="card">
            <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <div className="flex items-center gap-2">
                  <strong>{u.email}</strong>
                  {u.is_admin && <span className="badge badge-purple">Admin</span>}
                  {u.id === me?.id && <span className="badge badge-green">Você</span>}
                </div>
                <div className="text-muted text-sm mt-1">
                  {u.characters.length} personagem(ns):&nbsp;
                  {u.characters.map(c => `${c.name} (Nv ${c.level})`).join(', ') || '—'}
                </div>
              </div>
              {u.id !== me?.id && (
                <div className="flex gap-2">
                  <button className="btn-ghost btn-sm" onClick={() => toggleAdmin(u.id)}>
                    {u.is_admin ? 'Remover Admin' : 'Tornar Admin'}
                  </button>
                  <button className="btn-danger btn-sm" onClick={() => del(u.id)}>Excluir</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
