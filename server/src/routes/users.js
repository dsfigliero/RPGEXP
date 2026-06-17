const express = require('express');
const router = express.Router();
const { prepare } = require('../database');
const { authenticate, requireAdmin } = require('../middleware');

router.get('/', authenticate, requireAdmin, (req, res) => {
  const users = prepare('SELECT id, email, is_admin, created_at FROM users ORDER BY created_at DESC').all();
  const withChars = users.map(u => ({
    ...u,
    characters: prepare('SELECT id, name, level, total_xp FROM characters WHERE user_id = ?').all(u.id)
  }));
  res.json(withChars);
});

router.put('/:id/toggle-admin', authenticate, requireAdmin, (req, res) => {
  const user = prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(user.is_admin ? 0 : 1, user.id);
  res.json({ ok: true });
});

router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
