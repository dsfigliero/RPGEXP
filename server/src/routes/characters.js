const express = require('express');
const router = express.Router();
const { prepare } = require('../database');
const { authenticate } = require('../middleware');

router.get('/', authenticate, (req, res) => {
  res.json(prepare('SELECT * FROM characters WHERE user_id = ?').all(req.user.id));
});

router.post('/', authenticate, (req, res) => {
  const { name, class: charClass = '', level = 1 } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome obrigatório' });
  const result = prepare('INSERT INTO characters (name, class, level, user_id) VALUES (?, ?, ?, ?)').run(name, charClass, level, req.user.id);
  res.json(prepare('SELECT * FROM characters WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', authenticate, (req, res) => {
  const { name, class: charClass, level } = req.body;
  const char = prepare('SELECT * FROM characters WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!char) return res.status(404).json({ error: 'Personagem não encontrado' });
  prepare('UPDATE characters SET name = ?, class = ?, level = ? WHERE id = ?').run(name ?? char.name, charClass ?? char.class, level ?? char.level, char.id);
  res.json(prepare('SELECT * FROM characters WHERE id = ?').get(char.id));
});

router.delete('/:id', authenticate, (req, res) => {
  const char = prepare('SELECT * FROM characters WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!char) return res.status(404).json({ error: 'Personagem não encontrado' });
  prepare('DELETE FROM characters WHERE id = ?').run(char.id);
  res.json({ ok: true });
});

module.exports = router;
