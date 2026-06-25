import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { useState } from 'react'
import './Layout.css'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768)

  function handleLogout() {
    logout()
    navigate('/login')
  }

  function navClick() {
    if (window.innerWidth <= 768) setSidebarOpen(false)
  }

  return (
    <div className={`layout ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <div className="mobile-topbar">
        <button className="mobile-hamburger" onClick={() => setSidebarOpen(true)}>☰</button>
        <span className="mobile-topbar-title">⚔️ RPG XP</span>
      </div>

      <aside className="sidebar">
        <div className="sidebar-logo">
          <span>⚔️ RPG XP</span>
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(false)}>✕</button>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section-label">Jogador</div>
          <NavLink to="/" end onClick={navClick}>🏠 Painel</NavLink>
          <NavLink to="/characters" onClick={navClick}>🧙 Personagens</NavLink>
          <NavLink to="/sessions" onClick={navClick}>📜 Minhas Sessões</NavLink>
          <NavLink to="/campaigns" onClick={navClick}>🗺 Campanhas</NavLink>
          {user?.is_admin && <>
            <div className="nav-section-label" style={{ marginTop: '1rem' }}>Admin</div>
            <NavLink to="/admin/sessions" onClick={navClick}>🗂 Sessões</NavLink>
            <NavLink to="/admin/campaigns" onClick={navClick}>🗺 Campanhas</NavLink>
            <NavLink to="/admin/evaluation-items" onClick={navClick}>⭐ Itens de Avaliação</NavLink>
            <NavLink to="/admin/users" onClick={navClick}>👥 Usuários</NavLink>
            <NavLink to="/admin/character-logs" onClick={navClick}>📋 Log de Personagens</NavLink>
          </>}
        </nav>
        <div className="sidebar-footer">
          <span className="text-muted text-sm">{user?.email}</span>
          <button className="btn-ghost btn-sm" onClick={handleLogout}>Sair</button>
        </div>
      </aside>

      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      {!sidebarOpen && (
        <button className="sidebar-open-btn" onClick={() => setSidebarOpen(true)}>☰</button>
      )}

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
