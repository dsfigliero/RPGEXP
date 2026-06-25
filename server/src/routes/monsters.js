const express = require('express');
const router = express.Router();
const { prepare } = require('../database');
const { authenticate } = require('../middleware');

router.get('/', authenticate, (req, res) => {
  res.json(prepare(`
    SELECT ml.*, u.email as created_by_email
    FROM monster_library ml
    LEFT JOIN users u ON u.id = ml.created_by
    ORDER BY ml.name
  `).all());
});

router.post('/', authenticate, (req, res) => {
  const { name, hp = 0, max_hp = 0, ac = 10, initiative = 0, notes = '', attacks = '[]', monster_data = null } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome obrigatório' });
  const result = prepare(
    'INSERT INTO monster_library (name, hp, max_hp, ac, initiative, notes, attacks, monster_data, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(name, hp, max_hp, ac, initiative, notes, attacks, monster_data, req.user.id);
  res.json(prepare('SELECT * FROM monster_library WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', authenticate, (req, res) => {
  const monster = prepare('SELECT * FROM monster_library WHERE id = ?').get(req.params.id);
  if (!monster) return res.status(404).json({ error: 'Monstro não encontrado' });
  const { name, hp, max_hp, ac, initiative, notes, attacks, monster_data } = req.body;
  prepare('UPDATE monster_library SET name=?, hp=?, max_hp=?, ac=?, initiative=?, notes=?, attacks=?, monster_data=? WHERE id=?')
    .run(name ?? monster.name, hp ?? monster.hp, max_hp ?? monster.max_hp, ac ?? monster.ac, initiative ?? monster.initiative, notes ?? monster.notes, attacks ?? monster.attacks, monster_data !== undefined ? monster_data : monster.monster_data, monster.id);
  res.json(prepare('SELECT * FROM monster_library WHERE id = ?').get(monster.id));
});

router.delete('/:id', authenticate, (req, res) => {
  const monster = prepare('SELECT * FROM monster_library WHERE id = ?').get(req.params.id);
  if (!monster) return res.status(404).json({ error: 'Monstro não encontrado' });
  prepare('DELETE FROM monster_library WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
