const express = require('express');
const router = express.Router();
const { prepare } = require('../database');
const { authenticate, requireAdmin } = require('../middleware');

router.get('/', authenticate, (req, res) => {
  res.json(prepare('SELECT * FROM evaluation_items ORDER BY name').all());
});

router.post('/', authenticate, requireAdmin, (req, res) => {
  const { name, description = '', xp_value } = req.body;
  if (!name || xp_value == null) return res.status(400).json({ error: 'Nome e XP obrigatórios' });
  const result = prepare('INSERT INTO evaluation_items (name, description, xp_value) VALUES (?, ?, ?)').run(name, description, xp_value);
  res.json(prepare('SELECT * FROM evaluation_items WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', authenticate, requireAdmin, (req, res) => {
  const { name, description, xp_value } = req.body;
  const item = prepare('SELECT * FROM evaluation_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item não encontrado' });
  prepare('UPDATE evaluation_items SET name = ?, description = ?, xp_value = ? WHERE id = ?')
    .run(name ?? item.name, description ?? item.description, xp_value ?? item.xp_value, item.id);
  res.json(prepare('SELECT * FROM evaluation_items WHERE id = ?').get(item.id));
});

router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  prepare('DELETE FROM evaluation_items WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
