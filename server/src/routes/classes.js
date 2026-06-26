const express = require('express');
const router = express.Router();
const { prepare } = require('../database');
const { authenticate, requireAdmin } = require('../middleware');

function parseClassJson(d) {
  if (!d.name) throw new Error('Campo "name" obrigatório')

  const sc = d.spellcasting
  const usesMagic = sc && sc.type !== 'NONE' ? 1 : 0
  const rawStyle = (sc?.castingStyle || 'NONE').toLowerCase()
  const castingType = rawStyle === 'none' || rawStyle === 'hybrid' ? 'prepared' : rawStyle

  return {
    name: d.name,
    description: [d.description?.flavor, d.description?.role].filter(Boolean).join('\n\n'),
    uses_magic: usesMagic,
    casting_type: castingType,
    hit_die: d.hitDie || null,
    bab_progression: d.progressionType?.baseAttackBonus || null,
    skill_ranks_base: d.skillRanksPerLevel?.base ?? 2,
    source_book: d.source?.book || null,
    tags: JSON.stringify(d.tags || []),
    class_json: JSON.stringify(d),
  }
}

router.get('/', authenticate, (req, res) => {
  res.json(prepare('SELECT * FROM character_classes ORDER BY name').all());
});

router.post('/import', authenticate, requireAdmin, (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))
      return res.status(400).json({ error: 'Envie um único objeto JSON representando a classe.' })

    const p = parseClassJson(req.body)
    const existing = prepare('SELECT id FROM character_classes WHERE name = ?').get(p.name)

    if (existing) {
      prepare(`UPDATE character_classes SET description=?, uses_magic=?, casting_type=?, hit_die=?, bab_progression=?, skill_ranks_base=?, source_book=?, tags=?, class_json=? WHERE id=?`)
        .run(p.description, p.uses_magic, p.casting_type, p.hit_die, p.bab_progression, p.skill_ranks_base, p.source_book, p.tags, p.class_json, existing.id)
      return res.json({ ok: true, action: 'updated', class: prepare('SELECT * FROM character_classes WHERE id = ?').get(existing.id) })
    }

    const result = prepare(`INSERT INTO character_classes (name, description, uses_magic, casting_type, hit_die, bab_progression, skill_ranks_base, source_book, tags, class_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(p.name, p.description, p.uses_magic, p.casting_type, p.hit_die, p.bab_progression, p.skill_ranks_base, p.source_book, p.tags, p.class_json)
    return res.json({ ok: true, action: 'created', class: prepare('SELECT * FROM character_classes WHERE id = ?').get(result.lastInsertRowid) })
  } catch (e) {
    return res.status(400).json({ error: e.message })
  }
})

router.post('/', authenticate, requireAdmin, (req, res) => {
  const { name, description = '', uses_magic = 0, casting_type = 'prepared' } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome obrigatório' });
  const exists = prepare('SELECT id FROM character_classes WHERE name = ?').get(name);
  if (exists) return res.status(400).json({ error: 'Classe já cadastrada' });
  const result = prepare('INSERT INTO character_classes (name, description, uses_magic, casting_type) VALUES (?, ?, ?, ?)').run(name, description, uses_magic ? 1 : 0, casting_type);
  res.json(prepare('SELECT * FROM character_classes WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', authenticate, requireAdmin, (req, res) => {
  const cls = prepare('SELECT * FROM character_classes WHERE id = ?').get(req.params.id);
  if (!cls) return res.status(404).json({ error: 'Classe não encontrada' });
  const { name, description, uses_magic, casting_type } = req.body;
  prepare('UPDATE character_classes SET name=?, description=?, uses_magic=?, casting_type=? WHERE id=?')
    .run(
      name ?? cls.name,
      description ?? cls.description,
      uses_magic !== undefined ? (uses_magic ? 1 : 0) : cls.uses_magic,
      casting_type ?? cls.casting_type ?? 'prepared',
      cls.id
    );
  res.json(prepare('SELECT * FROM character_classes WHERE id = ?').get(cls.id));
});

router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  prepare('DELETE FROM character_classes WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
