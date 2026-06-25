const express = require('express');
const router = express.Router();
const { prepare } = require('../database');
const { authenticate, requireAdmin } = require('../middleware');

function isMestreOfCharacter(userId, charId) {
  const row = prepare(`
    SELECT cam.id FROM campaigns cam
    JOIN sessions s ON s.campaign_id = cam.id
    JOIN session_participants sp ON sp.session_id = s.id
    WHERE sp.character_id = ? AND cam.created_by = ?
    LIMIT 1
  `).get(charId, userId);
  return !!row;
}

const ALL_FIELDS = ['name','class','level','hp','max_hp','ac','initiative',
  'str_score','dex_score','con_score','int_score','wis_score','cha_score',
  'race','alignment','speed','bab','cmb','cmd','spell_resistance',
  'fortitude','will_save','reflex','char_notes'];

function buildLogEntry(oldChar, newChar) {
  const changed_old = {}, changed_new = {};
  for (const f of ALL_FIELDS) {
    if (oldChar[f] !== newChar[f]) {
      changed_old[f] = oldChar[f];
      changed_new[f] = newChar[f];
    }
  }
  return { changed_old, changed_new, hasChanges: Object.keys(changed_old).length > 0 };
}

router.get('/', authenticate, (req, res) => {
  res.json(prepare('SELECT * FROM characters WHERE user_id = ?').all(req.user.id));
});

// Admin: view change log — MUST be before /:id routes
router.get('/admin/change-logs', authenticate, requireAdmin, (req, res) => {
  res.json(prepare(`
    SELECT ccl.*, c.name as character_name
    FROM character_change_log ccl
    JOIN characters c ON c.id = ccl.character_id
    ORDER BY ccl.created_at DESC
    LIMIT 500
  `).all());
});

// GET a single character sheet — owner OR mestre
router.get('/:id/sheet', authenticate, (req, res) => {
  const char = prepare('SELECT c.*, u.email as user_email FROM characters c JOIN users u ON u.id = c.user_id WHERE c.id = ?').get(req.params.id);
  if (!char) return res.status(404).json({ error: 'Personagem não encontrado' });
  const isOwner = char.user_id === req.user.id;
  const isMestre = isMestreOfCharacter(req.user.id, req.params.id);
  if (!isOwner && !isMestre && !req.user.is_admin)
    return res.status(403).json({ error: 'Acesso negado' });
  res.json(char);
});

router.post('/', authenticate, (req, res) => {
  const {
    name, class: charClass = '', level = 1, hp = 0, max_hp = 0, ac = 10, initiative = 0,
    str_score = 10, dex_score = 10, con_score = 10, int_score = 10, wis_score = 10, cha_score = 10,
    race = '', alignment = '', speed = 30, bab = 0, cmb = 0, cmd = 10,
    spell_resistance = 0, fortitude = 0, will_save = 0, reflex = 0, char_notes = ''
  } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome obrigatório' });
  const result = prepare(`
    INSERT INTO characters (name, class, level, hp, max_hp, ac, initiative,
      str_score, dex_score, con_score, int_score, wis_score, cha_score,
      race, alignment, speed, bab, cmb, cmd, spell_resistance,
      fortitude, will_save, reflex, char_notes, user_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(name, charClass, level, hp, max_hp, ac, initiative,
    str_score, dex_score, con_score, int_score, wis_score, cha_score,
    race, alignment, speed, bab, cmb, cmd, spell_resistance,
    fortitude, will_save, reflex, char_notes, req.user.id);
  res.json(prepare('SELECT * FROM characters WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', authenticate, (req, res) => {
  const char = prepare('SELECT * FROM characters WHERE id = ?').get(req.params.id);
  if (!char) return res.status(404).json({ error: 'Personagem não encontrado' });
  const isOwner = char.user_id === req.user.id;
  const isMestre = isMestreOfCharacter(req.user.id, req.params.id);
  if (!isOwner && !isMestre && !req.user.is_admin)
    return res.status(403).json({ error: 'Acesso negado' });

  const {
    name, class: charClass, level, hp, max_hp, ac, initiative,
    str_score, dex_score, con_score, int_score, wis_score, cha_score,
    race, alignment, speed, bab, cmb, cmd, spell_resistance,
    fortitude, will_save, reflex, char_notes
  } = req.body;

  const updated = {
    name: name ?? char.name,
    class: charClass ?? char.class,
    level: level ?? char.level,
    hp: hp ?? char.hp,
    max_hp: max_hp ?? char.max_hp,
    ac: ac ?? char.ac,
    initiative: initiative ?? char.initiative,
    str_score: str_score ?? char.str_score,
    dex_score: dex_score ?? char.dex_score,
    con_score: con_score ?? char.con_score,
    int_score: int_score ?? char.int_score,
    wis_score: wis_score ?? char.wis_score,
    cha_score: cha_score ?? char.cha_score,
    race: race ?? char.race,
    alignment: alignment ?? char.alignment,
    speed: speed ?? char.speed,
    bab: bab ?? char.bab,
    cmb: cmb ?? char.cmb,
    cmd: cmd ?? char.cmd,
    spell_resistance: spell_resistance ?? char.spell_resistance,
    fortitude: fortitude ?? char.fortitude,
    will_save: will_save ?? char.will_save,
    reflex: reflex ?? char.reflex,
    char_notes: char_notes ?? char.char_notes,
  };

  prepare(`
    UPDATE characters SET name=?, class=?, level=?, hp=?, max_hp=?, ac=?, initiative=?,
      str_score=?, dex_score=?, con_score=?, int_score=?, wis_score=?, cha_score=?,
      race=?, alignment=?, speed=?, bab=?, cmb=?, cmd=?, spell_resistance=?,
      fortitude=?, will_save=?, reflex=?, char_notes=?
    WHERE id=?
  `).run(
    updated.name, updated.class, updated.level, updated.hp, updated.max_hp, updated.ac, updated.initiative,
    updated.str_score, updated.dex_score, updated.con_score, updated.int_score, updated.wis_score, updated.cha_score,
    updated.race, updated.alignment, updated.speed, updated.bab, updated.cmb, updated.cmd, updated.spell_resistance,
    updated.fortitude, updated.will_save, updated.reflex, updated.char_notes, char.id
  );

  const { changed_old, changed_new, hasChanges } = buildLogEntry(char, updated);
  if (hasChanges) {
    prepare(`
      INSERT INTO character_change_log (character_id, changed_by, changed_by_email, old_values, new_values)
      VALUES (?, ?, ?, ?, ?)
    `).run(char.id, req.user.id, req.user.email, JSON.stringify(changed_old), JSON.stringify(changed_new));
  }

  res.json(prepare('SELECT * FROM characters WHERE id = ?').get(char.id));
});

router.delete('/:id', authenticate, (req, res) => {
  const char = prepare('SELECT * FROM characters WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!char) return res.status(404).json({ error: 'Personagem não encontrado' });
  prepare('DELETE FROM characters WHERE id = ?').run(char.id);
  res.json({ ok: true });
});

router.get('/:id/effects', authenticate, (req, res) => {
  const char = prepare('SELECT id FROM characters WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!char) return res.status(404).json({ error: 'Personagem não encontrado' });
  res.json(prepare('SELECT * FROM character_effects WHERE character_id = ? ORDER BY created_at DESC').all(req.params.id));
});

router.post('/:id/effects', authenticate, (req, res) => {
  const char = prepare('SELECT id FROM characters WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!char) return res.status(404).json({ error: 'Personagem não encontrado' });
  const { name, description = '', effect_type = 'other', session_id = null } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome obrigatório' });
  const result = prepare('INSERT INTO character_effects (character_id, session_id, name, description, effect_type) VALUES (?, ?, ?, ?, ?)').run(req.params.id, session_id, name, description, effect_type);
  res.json(prepare('SELECT * FROM character_effects WHERE id = ?').get(result.lastInsertRowid));
});

router.delete('/:id/effects/:effectId', authenticate, (req, res) => {
  const char = prepare('SELECT id FROM characters WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!char) return res.status(404).json({ error: 'Personagem não encontrado' });
  prepare('DELETE FROM character_effects WHERE id = ? AND character_id = ?').run(req.params.effectId, req.params.id);
  res.json({ ok: true });
});

router.get('/:id/xp-history', authenticate, (req, res) => {
  const char = prepare('SELECT id FROM characters WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!char) return res.status(404).json({ error: 'Personagem não encontrado' });
  res.json(prepare(`
    SELECT xr.*, s.name as session_name, cam.name as campaign_name
    FROM xp_records xr
    JOIN sessions s ON s.id = xr.session_id
    LEFT JOIN campaigns cam ON cam.id = s.campaign_id
    WHERE xr.character_id = ?
    ORDER BY xr.created_at DESC
  `).all(req.params.id));
});

router.get('/:id/change-log', authenticate, requireAdmin, (req, res) => {
  res.json(prepare(`
    SELECT ccl.*, c.name as character_name
    FROM character_change_log ccl
    JOIN characters c ON c.id = ccl.character_id
    WHERE ccl.character_id = ?
    ORDER BY ccl.created_at DESC
  `).all(req.params.id));
});

module.exports = router;
