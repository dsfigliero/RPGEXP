const express = require('express');
const router = express.Router();
const { prepare } = require('../database');
const { authenticate, requireAdmin } = require('../middleware');
const sessionEvents = require('../sessionEvents');

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

function emitSpellUpdate(characterId) {
  try {
    const sessions = prepare(`
      SELECT sp.session_id FROM session_participants sp
      JOIN sessions s ON s.id = sp.session_id
      WHERE sp.character_id = ? AND s.is_finalized = 0
    `).all(characterId)
    for (const s of sessions) {
      sessionEvents.emit(`session:${s.session_id}`, { type: 'spells_updated', character_id: Number(characterId) })
    }
  } catch(e) {}
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
  const charClass = char.class_id ? prepare('SELECT * FROM character_classes WHERE id = ?').get(char.class_id) : null;
  const charFeats = prepare('SELECT f.* FROM feats f JOIN character_feats cf ON cf.feat_id = f.id WHERE cf.character_id = ?').all(char.id);
  res.json({ ...char, class_info: charClass, feats: charFeats });
});

router.post('/', authenticate, (req, res) => {
  const {
    name, class: charClass = '', class_id = null, level = 1, hp = 0, max_hp = 0, ac = 10, initiative = 0,
    str_score = 10, dex_score = 10, con_score = 10, int_score = 10, wis_score = 10, cha_score = 10,
    race = '', alignment = '', speed = 30, bab = 0, cmb = 0, cmd = 10,
    spell_resistance = 0, fortitude = 0, will_save = 0, reflex = 0, char_notes = ''
  } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome obrigatório' });
  // If class_id given, resolve class name for backward compat
  let resolvedClass = charClass;
  if (class_id) {
    const cls = prepare('SELECT name FROM character_classes WHERE id = ?').get(class_id);
    if (cls) resolvedClass = cls.name;
  }
  const result = prepare(`
    INSERT INTO characters (name, class, class_id, level, hp, max_hp, ac, initiative,
      str_score, dex_score, con_score, int_score, wis_score, cha_score,
      race, alignment, speed, bab, cmb, cmd, spell_resistance,
      fortitude, will_save, reflex, char_notes, user_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(name, resolvedClass, class_id || null, level, hp, max_hp, ac, initiative,
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
    name, class: charClass, class_id, level, hp, max_hp, ac, initiative,
    str_score, dex_score, con_score, int_score, wis_score, cha_score,
    race, alignment, speed, bab, cmb, cmd, spell_resistance,
    fortitude, will_save, reflex, char_notes, advancement_speed
  } = req.body;

  // Resolve class name from class_id if provided
  let resolvedClass = charClass ?? char.class;
  const resolvedClassId = class_id !== undefined ? (class_id || null) : char.class_id;
  if (class_id !== undefined && class_id) {
    const cls = prepare('SELECT name FROM character_classes WHERE id = ?').get(class_id);
    if (cls) resolvedClass = cls.name;
  }

  const updated = {
    name: name ?? char.name,
    class: resolvedClass,
    class_id: resolvedClassId,
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
    advancement_speed: advancement_speed ?? char.advancement_speed ?? 'medium',
  };

  prepare(`
    UPDATE characters SET name=?, class=?, class_id=?, level=?, hp=?, max_hp=?, ac=?, initiative=?,
      str_score=?, dex_score=?, con_score=?, int_score=?, wis_score=?, cha_score=?,
      race=?, alignment=?, speed=?, bab=?, cmb=?, cmd=?, spell_resistance=?,
      fortitude=?, will_save=?, reflex=?, char_notes=?, advancement_speed=?
    WHERE id=?
  `).run(
    updated.name, updated.class, updated.class_id, updated.level, updated.hp, updated.max_hp, updated.ac, updated.initiative,
    updated.str_score, updated.dex_score, updated.con_score, updated.int_score, updated.wis_score, updated.cha_score,
    updated.race, updated.alignment, updated.speed, updated.bab, updated.cmb, updated.cmd, updated.spell_resistance,
    updated.fortitude, updated.will_save, updated.reflex, updated.char_notes, updated.advancement_speed, char.id
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

// GET /:id/feats
router.get('/:id/feats', authenticate, (req, res) => {
  res.json(prepare(`
    SELECT f.* FROM feats f
    JOIN character_feats cf ON cf.feat_id = f.id
    WHERE cf.character_id = ?
    ORDER BY f.name
  `).all(req.params.id));
});

// POST /:id/feats
router.post('/:id/feats', authenticate, (req, res) => {
  const char = prepare('SELECT * FROM characters WHERE id = ?').get(req.params.id);
  if (!char) return res.status(404).json({ error: 'Personagem não encontrado' });
  if (char.user_id !== req.user.id && !req.user.is_admin) return res.status(403).json({ error: 'Acesso negado' });
  const { feat_id } = req.body;
  if (!feat_id) return res.status(400).json({ error: 'feat_id obrigatório' });
  prepare('INSERT OR IGNORE INTO character_feats (character_id, feat_id) VALUES (?, ?)').run(req.params.id, feat_id);
  res.json({ ok: true });
});

// DELETE /:id/feats/:featId
router.delete('/:id/feats/:featId', authenticate, (req, res) => {
  const char = prepare('SELECT * FROM characters WHERE id = ?').get(req.params.id);
  if (!char) return res.status(404).json({ error: 'Personagem não encontrado' });
  if (char.user_id !== req.user.id && !req.user.is_admin) return res.status(403).json({ error: 'Acesso negado' });
  prepare('DELETE FROM character_feats WHERE character_id = ? AND feat_id = ?').run(req.params.id, req.params.featId);
  res.json({ ok: true });
});

// GET /:id/spells — known spells list
router.get('/:id/spells', authenticate, (req, res) => {
  res.json(prepare('SELECT * FROM character_known_spells WHERE character_id = ? ORDER BY circle, name').all(req.params.id));
});

// POST /:id/spells — add spell to known list
router.post('/:id/spells', authenticate, (req, res) => {
  const char = prepare('SELECT * FROM characters WHERE id = ?').get(req.params.id);
  if (!char) return res.status(404).json({ error: 'Personagem não encontrado' });
  if (char.user_id !== req.user.id && !req.user.is_admin) return res.status(403).json({ error: 'Acesso negado' });
  const { name, circle = 0, school = '', description = '', components = '', casting_time = '', duration = '', range = '', saving_throw = '', notes = '' } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome obrigatório' });
  const result = prepare('INSERT INTO character_known_spells (character_id, name, circle, school, description, components, casting_time, duration, range, saving_throw, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(req.params.id, name, circle, school, description, components, casting_time, duration, range, saving_throw, notes);
  res.json(prepare('SELECT * FROM character_known_spells WHERE id = ?').get(result.lastInsertRowid));
});

// PATCH /:id/spells/reset-day — reset times_cast for all spells of a circle (spontaneous casters)
router.patch('/:id/spells/reset-day', authenticate, (req, res) => {
  const char = prepare('SELECT * FROM characters WHERE id = ?').get(req.params.id);
  if (!char) return res.status(404).json({ error: 'Não encontrado' });
  if (char.user_id !== req.user.id && !req.user.is_admin) return res.status(403).json({ error: 'Acesso negado' });
  const { circle } = req.body;
  if (circle === undefined) return res.status(400).json({ error: 'circle obrigatório' });
  prepare('UPDATE character_known_spells SET times_cast = 0 WHERE character_id = ? AND circle = ?').run(req.params.id, circle);
  emitSpellUpdate(req.params.id);
  res.json({ ok: true });
});

// PATCH /:id/spells/:spellId/use — increment/decrement times_cast for a known spell (spontaneous casters)
router.patch('/:id/spells/:spellId/use', authenticate, (req, res) => {
  const char = prepare('SELECT * FROM characters WHERE id = ?').get(req.params.id);
  if (!char) return res.status(404).json({ error: 'Não encontrado' });
  if (char.user_id !== req.user.id && !req.user.is_admin) return res.status(403).json({ error: 'Acesso negado' });
  const spell = prepare('SELECT * FROM character_known_spells WHERE id = ? AND character_id = ?').get(req.params.spellId, req.params.id);
  if (!spell) return res.status(404).json({ error: 'Magia não encontrada' });
  const { delta } = req.body;
  const newVal = Math.max(0, (spell.times_cast || 0) + (delta || 1));
  prepare('UPDATE character_known_spells SET times_cast = ? WHERE id = ?').run(newVal, spell.id);
  emitSpellUpdate(req.params.id);
  res.json(prepare('SELECT * FROM character_known_spells WHERE id = ?').get(spell.id));
});

// PUT /:id/spells/:spellId
router.put('/:id/spells/:spellId', authenticate, (req, res) => {
  const char = prepare('SELECT * FROM characters WHERE id = ?').get(req.params.id);
  if (!char) return res.status(404).json({ error: 'Personagem não encontrado' });
  if (char.user_id !== req.user.id && !req.user.is_admin) return res.status(403).json({ error: 'Acesso negado' });
  const spell = prepare('SELECT * FROM character_known_spells WHERE id = ? AND character_id = ?').get(req.params.spellId, req.params.id);
  if (!spell) return res.status(404).json({ error: 'Magia não encontrada' });
  const { name, circle, school, description, components, casting_time, duration, range, saving_throw, notes } = req.body;
  prepare('UPDATE character_known_spells SET name=?, circle=?, school=?, description=?, components=?, casting_time=?, duration=?, range=?, saving_throw=?, notes=? WHERE id=?')
    .run(name ?? spell.name, circle ?? spell.circle, school ?? spell.school, description ?? spell.description, components ?? spell.components, casting_time ?? spell.casting_time, duration ?? spell.duration, range ?? spell.range, saving_throw ?? spell.saving_throw, notes ?? spell.notes, spell.id);
  res.json(prepare('SELECT * FROM character_known_spells WHERE id = ?').get(spell.id));
});

// DELETE /:id/spells/:spellId
router.delete('/:id/spells/:spellId', authenticate, (req, res) => {
  const char = prepare('SELECT * FROM characters WHERE id = ?').get(req.params.id);
  if (!char) return res.status(404).json({ error: 'Personagem não encontrado' });
  if (char.user_id !== req.user.id && !req.user.is_admin) return res.status(403).json({ error: 'Acesso negado' });
  prepare('DELETE FROM character_known_spells WHERE id = ? AND character_id = ?').run(req.params.spellId, req.params.id);
  res.json({ ok: true });
});

// GET /:id/spell-slots
router.get('/:id/spell-slots', authenticate, (req, res) => {
  res.json(prepare('SELECT * FROM character_spell_slots WHERE character_id = ? ORDER BY circle').all(req.params.id));
});

// PUT /:id/spell-slots — upsert slot config for a circle
router.put('/:id/spell-slots', authenticate, (req, res) => {
  const char = prepare('SELECT * FROM characters WHERE id = ?').get(req.params.id);
  if (!char) return res.status(404).json({ error: 'Personagem não encontrado' });
  if (char.user_id !== req.user.id && !req.user.is_admin) return res.status(403).json({ error: 'Acesso negado' });
  const { circle, total_slots, used_slots } = req.body;
  if (circle === undefined) return res.status(400).json({ error: 'circle obrigatório' });
  const existing = prepare('SELECT * FROM character_spell_slots WHERE character_id = ? AND circle = ?').get(req.params.id, circle);
  if (existing) {
    prepare('UPDATE character_spell_slots SET total_slots = ?, used_slots = ? WHERE character_id = ? AND circle = ?')
      .run(total_slots ?? existing.total_slots, used_slots ?? existing.used_slots, req.params.id, circle);
  } else {
    prepare('INSERT INTO character_spell_slots (character_id, circle, total_slots, used_slots) VALUES (?, ?, ?, ?)').run(req.params.id, circle, total_slots ?? 0, used_slots ?? 0);
  }
  emitSpellUpdate(req.params.id)
  res.json(prepare('SELECT * FROM character_spell_slots WHERE character_id = ? AND circle = ?').get(req.params.id, circle));
});

// GET /:id/prepared-spells
router.get('/:id/prepared-spells', authenticate, (req, res) => {
  res.json(prepare('SELECT * FROM character_prepared_spells WHERE character_id = ? ORDER BY circle, created_at').all(req.params.id));
});

// POST /:id/prepared-spells
router.post('/:id/prepared-spells', authenticate, (req, res) => {
  const char = prepare('SELECT * FROM characters WHERE id = ?').get(req.params.id);
  if (!char) return res.status(404).json({ error: 'Personagem não encontrado' });
  if (char.user_id !== req.user.id && !req.user.is_admin) return res.status(403).json({ error: 'Acesso negado' });
  const { circle, spell_name, known_spell_id = null } = req.body;
  if (!spell_name || circle === undefined) return res.status(400).json({ error: 'circle e spell_name obrigatórios' });
  const result = prepare('INSERT INTO character_prepared_spells (character_id, known_spell_id, circle, spell_name) VALUES (?, ?, ?, ?)').run(req.params.id, known_spell_id, circle, spell_name);
  emitSpellUpdate(req.params.id)
  res.json(prepare('SELECT * FROM character_prepared_spells WHERE id = ?').get(result.lastInsertRowid));
});

// DELETE /:id/prepared-spells/:prepId
router.delete('/:id/prepared-spells/:prepId', authenticate, (req, res) => {
  const char = prepare('SELECT * FROM characters WHERE id = ?').get(req.params.id);
  if (!char) return res.status(404).json({ error: 'Personagem não encontrado' });
  if (char.user_id !== req.user.id && !req.user.is_admin) return res.status(403).json({ error: 'Acesso negado' });
  prepare('DELETE FROM character_prepared_spells WHERE id = ? AND character_id = ?').run(req.params.prepId, req.params.id);
  emitSpellUpdate(req.params.id)
  res.json({ ok: true });
});

// PATCH /:id/prepared-spells/:prepId/cast — toggle is_cast
router.patch('/:id/prepared-spells/:prepId/cast', authenticate, (req, res) => {
  const char = prepare('SELECT * FROM characters WHERE id = ?').get(req.params.id);
  if (!char) return res.status(404).json({ error: 'Personagem não encontrado' });
  if (char.user_id !== req.user.id && !req.user.is_admin) return res.status(403).json({ error: 'Acesso negado' });
  const prep = prepare('SELECT * FROM character_prepared_spells WHERE id = ? AND character_id = ?').get(req.params.prepId, req.params.id);
  if (!prep) return res.status(404).json({ error: 'Não encontrado' });
  prepare('UPDATE character_prepared_spells SET is_cast = ? WHERE id = ?').run(prep.is_cast ? 0 : 1, prep.id);
  emitSpellUpdate(req.params.id)
  res.json(prepare('SELECT * FROM character_prepared_spells WHERE id = ?').get(prep.id));
});

// GET /:id/spell-lock-status — check if character is in an active locked session
router.get('/:id/spell-lock-status', authenticate, (req, res) => {
  const locked = prepare(`
    SELECT s.id FROM sessions s
    JOIN session_participants sp ON sp.session_id = s.id
    WHERE sp.character_id = ? AND s.is_finalized = 0 AND s.spells_locked = 1
    LIMIT 1
  `).get(req.params.id);
  res.json({ spells_locked: locked ? 1 : 0 });
});

module.exports = router;
