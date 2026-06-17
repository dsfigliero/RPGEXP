import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { useState } from 'react'
import './Layout.css'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className={`layout ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span>⚔️ RPG XP</span>
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(false)}>✕</button>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section-label">Jogador</div>
          <NavLink to="/" end>🏠 Painel</NavLink>
          <NavLink to="/characters">🧙 Personagens</NavLink>
          <NavLink to="/sessions">📜 Minhas Sessões</NavLink>
          {user?.is_admin && <>
            <div className="nav-section-label" style={{ marginTop: '1rem' }}>Admin</div>
            <NavLink to="/admin/sessions">🗂 Sessões</NavLink>
            <NavLink to="/admin/evaluation-items">⭐ Itens de Avaliação</NavLink>
            <NavLink to="/admin/users">👥 Usuários</NavLink>
          </>}
        </nav>
        <div className="sidebar-footer">
          <span className="text-muted text-sm">{user?.email}</span>
          <button className="btn-ghost btn-sm" onClick={handleLogout}>Sair</button>
        </div>
      </aside>

      {!sidebarOpen && (
        <button className="sidebar-open-btn" onClick={() => setSidebarOpen(true)}>☰</button>
      )}

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
