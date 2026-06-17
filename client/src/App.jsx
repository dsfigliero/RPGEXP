import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Characters from './pages/Characters'
import MySessions from './pages/MySessions'
import SessionDetail from './pages/SessionDetail'
import EvaluationItems from './pages/admin/EvaluationItems'
import AdminSessions from './pages/admin/Sessions'
import AdminSessionDetail from './pages/admin/SessionDetail'
import Users from './pages/admin/Users'

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
            <Route path="admin/evaluation-items" element={<RequireAdmin><EvaluationItems /></RequireAdmin>} />
            <Route path="admin/sessions" element={<RequireAdmin><AdminSessions /></RequireAdmin>} />
            <Route path="admin/sessions/:id" element={<RequireAdmin><AdminSessionDetail /></RequireAdmin>} />
            <Route path="admin/users" element={<RequireAdmin><Users /></RequireAdmin>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
