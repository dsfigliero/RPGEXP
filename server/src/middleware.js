const { verifyToken } = require('./auth');

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Não autenticado' });
  const token = header.replace('Bearer ', '');
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user?.is_admin) return res.status(403).json({ error: 'Acesso negado' });
  next();
}

function requireMestre(req, res, next) {
  if (!req.user?.is_admin && !req.user?.is_mestre) return res.status(403).json({ error: 'Acesso negado' });
  next();
}

module.exports = { authenticate, requireAdmin, requireMestre };
