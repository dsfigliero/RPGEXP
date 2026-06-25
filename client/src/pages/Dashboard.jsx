import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import api from '../api'

export default function Dashboard() {
  const { user } = useAuth()
  const [characters, setCharacters] = useState([])
  const [sessions, setSessions] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/characters'),
      api.get('/sessions'),
      api.get('/campaigns')
    ]).then(([c, s, cam]) => {
      setCharacters(c.data)
      setSessions(s.data)
      setCampaigns(cam.data)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="page"><div className="spinner" /></div>

  return (
    <div className="page">
      <div className="page-header">
        <h1>Painel</h1>
        <span className="text-muted text-sm">Bem-vindo, {user?.email}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="text-muted text-sm mb-1">Personagens</div>
          <div style={{ fontSize: '2rem', fontWeight: 700 }}>{characters.length}</div>
        </div>
        <div className="card">
          <div className="text-muted text-sm mb-1">Sessões participadas</div>
          <div style={{ fontSize: '2rem', fontWeight: 700 }}>{sessions.length}</div>
        </div>
        <div className="card">
          <div className="text-muted text-sm mb-1">XP Total acumulado</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary)' }}>
            {characters.reduce((s, c) => s + c.total_xp, 0).toLocaleString('pt-BR')}
          </div>
        </div>
        <div className="card">
          <div className="text-muted text-sm mb-1">Campanhas</div>
          <div style={{ fontSize: '2rem', fontWeight: 700 }}>{campaigns.length}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1rem' }}>
        <div className="card">
          <div className="flex justify-between items-center mb-3">
            <strong>Meus Personagens</strong>
            <Link to="/characters" style={{ fontSize: '0.82rem' }}>Ver todos →</Link>
          </div>
          {characters.length === 0
            ? <p className="text-muted text-sm">Nenhum personagem ainda.</p>
            : characters.slice(0, 5).map(c => (
              <div key={c.id} className="flex justify-between items-center mb-2">
                <span>{c.name}</span>
                <span className="badge badge-purple">Nível {c.level}</span>
              </div>
            ))}
        </div>

        <div className="card">
          <div className="flex justify-between items-center mb-3">
            <strong>Últimas Sessões</strong>
            <Link to="/sessions" style={{ fontSize: '0.82rem' }}>Ver todas →</Link>
          </div>
          {sessions.length === 0
            ? <p className="text-muted text-sm">Nenhuma sessão ainda.</p>
            : sessions.slice(0, 5).map(s => (
              <div key={s.id} className="flex justify-between items-center mb-2">
                <Link to={`/sessions/${s.id}`}>{s.name}</Link>
                <span className={`badge ${s.is_finalized ? 'badge-green' : 'badge-yellow'}`}>
                  {s.is_finalized ? 'Finalizada' : 'Em andamento'}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
