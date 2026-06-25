const express = require('express');
const router = express.Router();
const { prepare } = require('../database');
const { authenticate, requireAdmin } = require('../middleware');

router.get('/', authenticate, (req, res) => {
  res.json(prepare('SELECT * FROM feats ORDER BY name').all());
});

router.post('/', authenticate, requireAdmin, (req, res) => {
  const { name, description = '' } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome obrigatório' });
  const exists = prepare('SELECT id FROM feats WHERE name = ?').get(name);
  if (exists) return res.status(400).json({ error: 'Talento já cadastrado' });
  const result = prepare('INSERT INTO feats (name, description) VALUES (?, ?)').run(name, description);
  res.json(prepare('SELECT * FROM feats WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', authenticate, requireAdmin, (req, res) => {
  const feat = prepare('SELECT * FROM feats WHERE id = ?').get(req.params.id);
  if (!feat) return res.status(404).json({ error: 'Talento não encontrado' });
  const { name, description } = req.body;
  prepare('UPDATE feats SET name=?, description=? WHERE id=?').run(name ?? feat.name, description ?? feat.description, feat.id);
  res.json(prepare('SELECT * FROM feats WHERE id = ?').get(feat.id));
});

router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  prepare('DELETE FROM feats WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
