import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Characters from './pages/Characters'
import MySessions from './pages/MySessions'
import SessionDetail from './pages/SessionDetail'
import Campaigns from './pages/Campaigns'
import CampaignDetail from './pages/CampaignDetail'
import CharacterPanel from './pages/CharacterPanel'
import GmDashboard from './pages/GmDashboard'
import SessionLive from './pages/SessionLive'
import EvaluationItems from './pages/admin/EvaluationItems'
import AdminSessions from './pages/admin/Sessions'
import AdminSessionDetail from './pages/admin/SessionDetail'
import AdminCampaigns from './pages/admin/Campaigns'
import AdminCampaignDetail from './pages/admin/CampaignDetail'
import Users from './pages/admin/Users'
import CharacterLogs from './pages/admin/CharacterLogs'

function RequireAuth({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace />
}

function RequireAdmin({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!user.is_admin) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
            <Route index element={<Dashboard />} />
            <Route path="characters" element={<Characters />} />
            <Route path="sessions" element={<MySessions />} />
            <Route path="sessions/:id" element={<SessionDetail />} />
            <Route path="sessions/:id/live" element={<SessionLive />} />
            <Route path="campaigns" element={<Campaigns />} />
            <Route path="campaigns/:id" element={<CampaignDetail />} />
            <Route path="characters/:id" element={<CharacterPanel />} />
            <Route path="dashboard/:sessionId" element={<GmDashboard />} />
            <Route path="admin/evaluation-items" element={<RequireAdmin><EvaluationItems /></RequireAdmin>} />
            <Route path="admin/sessions" element={<RequireAdmin><AdminSessions /></RequireAdmin>} />
            <Route path="admin/sessions/:id" element={<AdminSessionDetail />} />
            <Route path="admin/campaigns" element={<RequireAdmin><AdminCampaigns /></RequireAdmin>} />
            <Route path="admin/campaigns/:id" element={<RequireAdmin><AdminCampaignDetail /></RequireAdmin>} />
            <Route path="admin/users" element={<RequireAdmin><Users /></RequireAdmin>} />
            <Route path="admin/character-logs" element={<RequireAdmin><CharacterLogs /></RequireAdmin>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
