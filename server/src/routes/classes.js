const express = require('express');
const router = express.Router();
const { prepare } = require('../database');
const { authenticate, requireAdmin } = require('../middleware');

router.get('/', authenticate, (req, res) => {
  res.json(prepare('SELECT * FROM character_classes ORDER BY name').all());
});

router.post('/', authenticate, requireAdmin, (req, res) => {
  const { name, description = '', uses_magic = 0 } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome obrigatório' });
  const exists = prepare('SELECT id FROM character_classes WHERE name = ?').get(name);
  if (exists) return res.status(400).json({ error: 'Classe já cadastrada' });
  const result = prepare('INSERT INTO character_classes (name, description, uses_magic) VALUES (?, ?, ?)').run(name, description, uses_magic ? 1 : 0);
  res.json(prepare('SELECT * FROM character_classes WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', authenticate, requireAdmin, (req, res) => {
  const cls = prepare('SELECT * FROM character_classes WHERE id = ?').get(req.params.id);
  if (!cls) return res.status(404).json({ error: 'Classe não encontrada' });
  const { name, description, uses_magic } = req.body;
  prepare('UPDATE character_classes SET name=?, description=?, uses_magic=? WHERE id=?')
    .run(name ?? cls.name, description ?? cls.description, uses_magic !== undefined ? (uses_magic ? 1 : 0) : cls.uses_magic, cls.id);
  res.json(prepare('SELECT * FROM character_classes WHERE id = ?').get(cls.id));
});

router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  prepare('DELETE FROM character_classes WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
