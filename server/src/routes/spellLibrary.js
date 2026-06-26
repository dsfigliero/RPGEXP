const express = require('express')
const router = express.Router()
const { prepare } = require('../database')
const { authenticate, requireAdmin, requireMestre } = require('../middleware')

// Normalize a field that can be a string or {id, name} object
function str(v) { return v ? (typeof v === 'object' ? v.name || '' : String(v)) : '' }

// Helper: parse a raw spell object from the JSON template into DB columns.
// Handles two component formats:
//   Old: { verbal: true, somatic: true, materialDescription: '...' }
//   New: [{ type: 'Verbal' }, { type: 'Material', description: '...' }]
function parseSpell(d) {
  const rawComp = d.casting?.components
  const compParts = []
  const extras = []

  if (Array.isArray(rawComp)) {
    for (const c of rawComp) {
      const t = (c.type || '').toLowerCase()
      if (t === 'verbal') compParts.push('V')
      else if (t === 'somatic') compParts.push('S')
      else if (t === 'material') { compParts.push('M'); if (c.description) extras.push(`(${c.description})`) }
      else if (t === 'focus') { compParts.push('F'); if (c.description) extras.push(`[${c.description}]`) }
      else if (t === 'divinefocus') compParts.push('FD')
    }
  } else if (rawComp && typeof rawComp === 'object') {
    if (rawComp.verbal) compParts.push('V')
    if (rawComp.somatic) compParts.push('S')
    if (rawComp.material) { compParts.push('M'); if (rawComp.materialDescription) extras.push(`(${rawComp.materialDescription})`) }
    if (rawComp.focus) { compParts.push('F'); if (rawComp.focusDescription) extras.push(`[${rawComp.focusDescription}]`) }
    if (rawComp.divineFocus) compParts.push('FD')
  }
  const compStr = [...compParts, ...extras].join(', ')

  const st = d.savingThrow || {}
  const stParts = [str(st.type)].filter(Boolean)
  if (st.negates) stParts.push('nega')
  if (st.partial) stParts.push('parcial')
  if (st.harmless) stParts.push('inofensivo')

  const sr = d.spellResistance || {}
  const srStr = sr.allowed ? (sr.harmless ? 'sim (inofensivo)' : 'sim') : 'não'

  // Normalize levels: support both {class, level} and {classId, className, level}
  const levels = (d.levels || []).map(l => ({
    class: l.class || l.className || l.classId || '',
    classId: l.classId || '',
    level: l.level ?? 0,
  }))

  // Normalize descriptors: support both strings and {id, name} objects
  const descriptors = (d.descriptors || []).map(x => str(x)).filter(Boolean)

  return {
    name: d.name || d.id || '',
    display_name: d.displayName || d.name || '',
    school: str(d.school),
    subschool: str(d.subschool),
    descriptors: JSON.stringify(descriptors),
    levels: JSON.stringify(levels),
    casting_time: d.casting?.castingTime || '',
    components: compStr,
    range: d.effect?.range || '',
    area: d.effect?.area || '',
    effect: d.effect?.effect || '',
    target: d.effect?.target || '',
    duration: d.duration || '',
    saving_throw: stParts.join(', '),
    spell_resistance: srStr,
    description_short: d.description?.short || '',
    description_full: d.description?.full || d.description?.short || '',
    source: JSON.stringify(d.source || {}),
    raw_data: JSON.stringify(d),
  }
}

// GET / — list all, with optional search
router.get('/', authenticate, (req, res) => {
  const { q, class: cls, level } = req.query
  let sql = 'SELECT id, name, display_name, school, subschool, levels, casting_time, components, range, duration, saving_throw, spell_resistance, description_short FROM spell_library WHERE 1=1'
  const params = []
  if (q) { sql += ' AND (name LIKE ? OR display_name LIKE ? OR description_short LIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`) }
  sql += ' ORDER BY name'
  const spells = prepare(sql).all(...params)
  // Filter by class/level in JS (levels is JSON)
  let result = spells.map(s => ({ ...s, levels: JSON.parse(s.levels || '[]') }))
  if (cls) result = result.filter(s => s.levels.some(l => (l.class || '').toLowerCase().includes(cls.toLowerCase()) || cls.toLowerCase().includes((l.class || '').toLowerCase())))
  if (level !== undefined) result = result.filter(s => s.levels.some(l => l.level === Number(level)))
  res.json(result)
})

// GET /:id — full detail
router.get('/:id', authenticate, (req, res) => {
  const spell = prepare('SELECT * FROM spell_library WHERE id = ?').get(req.params.id)
  if (!spell) return res.status(404).json({ error: 'Não encontrado' })
  res.json({ ...spell, levels: JSON.parse(spell.levels || '[]'), descriptors: JSON.parse(spell.descriptors || '[]') })
})

// POST /import — batch import array of spells (must be before /:id)
router.post('/import', authenticate, requireMestre, (req, res) => {
  const arr = Array.isArray(req.body) ? req.body : [req.body]
  if (arr.length === 0) return res.status(400).json({ error: 'Array vazio' })

  let inserted = 0, skipped = 0, errors = []
  for (const d of arr) {
    try {
      if (!d.name && !d.id && !d.displayName) { skipped++; continue }
      const p = parseSpell(d)
      // Skip duplicates by name
      const existing = prepare('SELECT id FROM spell_library WHERE name = ?').get(p.name)
      if (existing) { skipped++; continue }
      prepare(`
        INSERT INTO spell_library (name, display_name, school, subschool, descriptors, levels, casting_time, components, range, area, effect, target, duration, saving_throw, spell_resistance, description_short, description_full, source, raw_data, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(p.name, p.display_name, p.school, p.subschool, p.descriptors, p.levels, p.casting_time, p.components, p.range, p.area, p.effect, p.target, p.duration, p.saving_throw, p.spell_resistance, p.description_short, p.description_full, p.source, p.raw_data, req.user.id)
      inserted++
    } catch(e) { errors.push({ name: d.name || d.id, error: e.message }); skipped++ }
  }
  res.json({ ok: true, inserted, skipped, errors })
})

// POST / — add single spell (mestre/admin only)
router.post('/', authenticate, requireMestre, (req, res) => {
  const d = req.body
  if (!d.name && !d.id && !d.displayName) return res.status(400).json({ error: 'name obrigatório' })
  const p = parseSpell(d)
  const result = prepare(`
    INSERT INTO spell_library (name, display_name, school, subschool, descriptors, levels, casting_time, components, range, area, effect, target, duration, saving_throw, spell_resistance, description_short, description_full, source, raw_data, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(p.name, p.display_name, p.school, p.subschool, p.descriptors, p.levels, p.casting_time, p.components, p.range, p.area, p.effect, p.target, p.duration, p.saving_throw, p.spell_resistance, p.description_short, p.description_full, p.source, p.raw_data, req.user.id)
  res.json(prepare('SELECT * FROM spell_library WHERE id = ?').get(result.lastInsertRowid))
})

// DELETE /:id — mestre/admin only
router.delete('/:id', authenticate, requireMestre, (req, res) => {
  prepare('DELETE FROM spell_library WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

module.exports = router
