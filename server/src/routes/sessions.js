const express = require('express');
const router = express.Router();
const { prepare, transaction } = require('../database');
const { authenticate, requireAdmin } = require('../middleware');

function isMestreOfCampaign(userId, campaignId) {
  if (!campaignId) return false;
  const c = prepare('SELECT created_by FROM campaigns WHERE id = ?').get(campaignId);
  return c && c.created_by === userId;
}

function canManageSession(user, sessionId) {
  if (user.is_admin) return true;
  const s = prepare('SELECT campaign_id FROM sessions WHERE id = ?').get(sessionId);
  return s && isMestreOfCampaign(user.id, s.campaign_id);
}

function calculateXP(sessionId) {
  const items = prepare(`
    SELECT scei.quantity, ei.xp_value, scei.character_id
    FROM session_character_evaluation_items scei
    JOIN evaluation_items ei ON ei.id = scei.evaluation_item_id
    WHERE scei.session_id = ?
  `).all(sessionId);

  const totalXP = items.reduce((sum, i) => sum + i.xp_value * i.quantity, 0);

  const participants = prepare(`
    SELECT c.id, c.level FROM session_participants sp
    JOIN characters c ON c.id = sp.character_id
    WHERE sp.session_id = ?
  `).all(sessionId);

  if (!participants.length) return [];

  const sumLevels = participants.reduce((s, p) => s + p.level, 0);
  const minLevel = Math.min(...participants.map(p => p.level));

  return participants.map(p => {
    const base = Math.floor((p.level / sumLevels) * totalXP);
    const penalty = (p.level - minLevel) * 100;
    return { character_id: p.id, xp: Math.max(0, base - penalty) };
  });
}

router.get('/', authenticate, (req, res) => {
  if (req.user.is_admin) {
    return res.json(prepare(`
      SELECT s.*, cam.name as campaign_name FROM sessions s
      LEFT JOIN campaigns cam ON cam.id = s.campaign_id
      ORDER BY s.date DESC
    `).all());
  }
  res.json(prepare(`
    SELECT DISTINCT s.*, cam.name as campaign_name FROM sessions s
    LEFT JOIN campaigns cam ON cam.id = s.campaign_id
    JOIN session_participants sp ON sp.session_id = s.id
    JOIN characters c ON c.id = sp.character_id
    WHERE c.user_id = ?
    ORDER BY s.date DESC
  `).all(req.user.id));
});

router.get('/admin/all-characters', authenticate, requireAdmin, (req, res) => {
  res.json(prepare(`
    SELECT c.*, u.email as user_email FROM characters c
    JOIN users u ON u.id = c.user_id
    ORDER BY u.email, c.name
  `).all());
});

router.get('/:id', authenticate, (req, res) => {
  const session = prepare('SELECT s.*, cam.name as campaign_name FROM sessions s LEFT JOIN campaigns cam ON cam.id = s.campaign_id WHERE s.id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Sessão não encontrada' });

  const participants = prepare(`
    SELECT c.*, u.email as user_email FROM session_participants sp
    JOIN characters c ON c.id = sp.character_id
    JOIN users u ON u.id = c.user_id
    WHERE sp.session_id = ?
  `).all(req.params.id);

  const actions = prepare(`
    SELECT scei.*, ei.name as item_name, ei.xp_value, c.name as character_name
    FROM session_character_evaluation_items scei
    JOIN evaluation_items ei ON ei.id = scei.evaluation_item_id
    JOIN characters c ON c.id = scei.character_id
    WHERE scei.session_id = ?
  `).all(req.params.id);

  const xpRecords = prepare(`
    SELECT xr.*, c.name as character_name FROM xp_records xr
    JOIN characters c ON c.id = xr.character_id
    WHERE xr.session_id = ?
  `).all(req.params.id);

  res.json({ ...session, participants, actions, xp_records: xpRecords });
});

router.post('/', authenticate, (req, res) => {
  const { name, description = '', date, campaign_id } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome obrigatório' });
  if (!req.user.is_admin && !isMestreOfCampaign(req.user.id, campaign_id))
    return res.status(403).json({ error: 'Acesso negado' });
  const result = prepare('INSERT INTO sessions (name, description, date, campaign_id) VALUES (?, ?, ?, ?)').run(name, description, date || new Date().toISOString(), campaign_id || null);
  res.json(prepare('SELECT s.*, cam.name as campaign_name FROM sessions s LEFT JOIN campaigns cam ON cam.id = s.campaign_id WHERE s.id = ?').get(result.lastInsertRowid));
});

router.put('/:id', authenticate, (req, res) => {
  const { name, description, date } = req.body;
  const session = prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Sessão não encontrada' });
  if (!canManageSession(req.user, req.params.id))
    return res.status(403).json({ error: 'Acesso negado' });
  prepare('UPDATE sessions SET name = ?, description = ?, date = ? WHERE id = ?')
    .run(name ?? session.name, description ?? session.description, date ?? session.date, session.id);
  res.json(prepare('SELECT * FROM sessions WHERE id = ?').get(session.id));
});

router.post('/:id/participants', authenticate, (req, res) => {
  if (!canManageSession(req.user, req.params.id))
    return res.status(403).json({ error: 'Acesso negado' });
  const { character_id } = req.body;
  prepare('INSERT OR IGNORE INTO session_participants (session_id, character_id) VALUES (?, ?)').run(req.params.id, character_id);
  res.json({ ok: true });
});

router.delete('/:id/participants/:characterId', authenticate, (req, res) => {
  if (!canManageSession(req.user, req.params.id))
    return res.status(403).json({ error: 'Acesso negado' });
  prepare('DELETE FROM session_participants WHERE session_id = ? AND character_id = ?').run(req.params.id, req.params.characterId);
  res.json({ ok: true });
});

router.post('/:id/actions', authenticate, (req, res) => {
  if (!canManageSession(req.user, req.params.id))
    return res.status(403).json({ error: 'Acesso negado' });
  const { character_id, evaluation_item_id, quantity = 1 } = req.body;
  const existing = prepare(`
    SELECT quantity FROM session_character_evaluation_items
    WHERE session_id = ? AND character_id = ? AND evaluation_item_id = ?
  `).get(req.params.id, character_id, evaluation_item_id);

  if (existing) {
    prepare(`
      UPDATE session_character_evaluation_items SET quantity = quantity + ?
      WHERE session_id = ? AND character_id = ? AND evaluation_item_id = ?
    `).run(quantity, req.params.id, character_id, evaluation_item_id);
  } else {
    prepare(`
      INSERT INTO session_character_evaluation_items (session_id, character_id, evaluation_item_id, quantity)
      VALUES (?, ?, ?, ?)
    `).run(req.params.id, character_id, evaluation_item_id, quantity);
  }
  res.json({ ok: true });
});

router.delete('/:id/actions', authenticate, (req, res) => {
  if (!canManageSession(req.user, req.params.id))
    return res.status(403).json({ error: 'Acesso negado' });
  const { character_id, evaluation_item_id } = req.body;
  prepare('DELETE FROM session_character_evaluation_items WHERE session_id = ? AND character_id = ? AND evaluation_item_id = ?')
    .run(req.params.id, character_id, evaluation_item_id);
  res.json({ ok: true });
});

router.post('/:id/finalize', authenticate, (req, res) => {
  if (!canManageSession(req.user, req.params.id))
    return res.status(403).json({ error: 'Acesso negado' });
  const session = prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Sessão não encontrada' });
  if (session.is_finalized) return res.status(400).json({ error: 'Sessão já finalizada' });

  const xpResults = calculateXP(req.params.id);

  const finalize = transaction(() => {
    for (const r of xpResults) {
      prepare('INSERT INTO xp_records (session_id, character_id, xp_granted) VALUES (?, ?, ?)').run(req.params.id, r.character_id, r.xp);
      prepare('UPDATE characters SET total_xp = total_xp + ? WHERE id = ?').run(r.xp, r.character_id);
    }
    prepare('UPDATE sessions SET is_finalized = 1 WHERE id = ?').run(req.params.id);
  });

  finalize();
  res.json({ ok: true, xp_results: xpResults });
});

module.exports = router;
