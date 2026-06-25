const express = require('express');
const router = express.Router();
const { prepare } = require('../database');
const { authenticate, requireAdmin } = require('../middleware');

function isMestre(userId, campaignId) {
  const c = prepare('SELECT created_by FROM campaigns WHERE id = ?').get(campaignId);
  return c && c.created_by === userId;
}

// GET / — my campaigns: where user is Mestre OR a participant in any session
router.get('/', authenticate, (req, res) => {
  if (req.user.is_admin) {
    const rows = prepare(`
      SELECT cam.*, u.email as mestre_email,
        (SELECT COUNT(*) FROM sessions WHERE campaign_id = cam.id) as session_count,
        (SELECT COUNT(*) FROM campaign_join_requests WHERE campaign_id = cam.id AND status = 'pending') as pending_requests
      FROM campaigns cam LEFT JOIN users u ON u.id = cam.created_by
      ORDER BY cam.created_at DESC
    `).all();
    return res.json(rows);
  }
  const rows = prepare(`
    SELECT DISTINCT cam.*, u.email as mestre_email,
      (SELECT COUNT(*) FROM sessions WHERE campaign_id = cam.id) as session_count,
      (SELECT COUNT(*) FROM campaign_join_requests WHERE campaign_id = cam.id AND status = 'pending') as pending_requests
    FROM campaigns cam LEFT JOIN users u ON u.id = cam.created_by
    WHERE cam.created_by = ?
      OR cam.id IN (
        SELECT DISTINCT s.campaign_id FROM sessions s
        JOIN session_participants sp ON sp.session_id = s.id
        JOIN characters c ON c.id = sp.character_id
        WHERE c.user_id = ? AND s.campaign_id IS NOT NULL
      )
    ORDER BY cam.created_at DESC
  `).all(req.user.id, req.user.id);
  res.json(rows);
});

// GET /discover — public campaigns the user is NOT already in
router.get('/discover', authenticate, (req, res) => {
  const rows = prepare(`
    SELECT cam.*, u.email as mestre_email,
      (SELECT COUNT(*) FROM sessions WHERE campaign_id = cam.id) as session_count
    FROM campaigns cam LEFT JOIN users u ON u.id = cam.created_by
    WHERE cam.is_public = 1
      AND (cam.created_by IS NULL OR cam.created_by != ?)
      AND cam.id NOT IN (
        SELECT DISTINCT s.campaign_id FROM sessions s
        JOIN session_participants sp ON sp.session_id = s.id
        JOIN characters c ON c.id = sp.character_id
        WHERE c.user_id = ? AND s.campaign_id IS NOT NULL
      )
    ORDER BY cam.created_at DESC
  `).all(req.user.id, req.user.id);
  const withStatus = rows.map(c => ({
    ...c,
    my_request: prepare('SELECT status FROM campaign_join_requests WHERE campaign_id = ? AND user_id = ?').get(c.id, req.user.id)?.status || null
  }));
  res.json(withStatus);
});

// GET /:id — campaign detail with sessions and join_requests (if Mestre/Admin)
router.get('/:id', authenticate, (req, res) => {
  const campaign = prepare(`
    SELECT cam.*, u.email as mestre_email FROM campaigns cam
    LEFT JOIN users u ON u.id = cam.created_by WHERE cam.id = ?
  `).get(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const isAdmin = req.user.is_admin;
  const isMestreOfThis = campaign.created_by === req.user.id;
  const isParticipant = !!prepare(`
    SELECT 1 FROM sessions s
    JOIN session_participants sp ON sp.session_id = s.id
    JOIN characters c ON c.id = sp.character_id
    WHERE s.campaign_id = ? AND c.user_id = ?
  `).get(req.params.id, req.user.id);

  if (!isAdmin && !isMestreOfThis && !campaign.is_public && !isParticipant)
    return res.status(403).json({ error: 'Acesso negado' });

  const sessions = prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM session_participants WHERE session_id = s.id) as participant_count
    FROM sessions s WHERE s.campaign_id = ? ORDER BY s.date DESC
  `).all(req.params.id);

  const join_requests = (isAdmin || isMestreOfThis)
    ? prepare(`
        SELECT jr.*, u.email as user_email FROM campaign_join_requests jr
        JOIN users u ON u.id = jr.user_id
        WHERE jr.campaign_id = ? ORDER BY jr.created_at DESC
      `).all(req.params.id)
    : [];

  res.json({ ...campaign, sessions, join_requests });
});

// POST / — any authenticated user creates campaign (becomes Mestre)
router.post('/', authenticate, (req, res) => {
  const { name, description = '', is_public = 0 } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome obrigatório' });
  const result = prepare(
    'INSERT INTO campaigns (name, description, is_public, created_by) VALUES (?, ?, ?, ?)'
  ).run(name, description, is_public ? 1 : 0, req.user.id);
  res.json(prepare('SELECT * FROM campaigns WHERE id = ?').get(result.lastInsertRowid));
});

// PUT /:id — admin or Mestre
router.put('/:id', authenticate, (req, res) => {
  const campaign = prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
  if (!req.user.is_admin && campaign.created_by !== req.user.id)
    return res.status(403).json({ error: 'Acesso negado' });
  const { name, description, is_public } = req.body;
  prepare('UPDATE campaigns SET name = ?, description = ?, is_public = ? WHERE id = ?').run(
    name ?? campaign.name,
    description ?? campaign.description,
    is_public !== undefined ? (is_public ? 1 : 0) : campaign.is_public,
    campaign.id
  );
  res.json(prepare('SELECT * FROM campaigns WHERE id = ?').get(campaign.id));
});

// DELETE /:id — admin or Mestre
router.delete('/:id', authenticate, (req, res) => {
  const campaign = prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
  if (!req.user.is_admin && campaign.created_by !== req.user.id)
    return res.status(403).json({ error: 'Acesso negado' });
  prepare('DELETE FROM campaigns WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// POST /:id/request-join — player requests to join a public campaign
router.post('/:id/request-join', authenticate, (req, res) => {
  const campaign = prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
  if (!campaign.is_public) return res.status(403).json({ error: 'Campanha privada' });
  if (campaign.created_by === req.user.id) return res.status(400).json({ error: 'Você é o Mestre desta campanha' });
  const existing = prepare('SELECT * FROM campaign_join_requests WHERE campaign_id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (existing) return res.status(400).json({ error: 'Solicitação já enviada' });
  prepare('INSERT INTO campaign_join_requests (campaign_id, user_id) VALUES (?, ?)').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// PUT /:id/join-requests/:requestId — approve or reject (admin or Mestre)
router.put('/:id/join-requests/:requestId', authenticate, (req, res) => {
  const campaign = prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
  if (!req.user.is_admin && campaign.created_by !== req.user.id)
    return res.status(403).json({ error: 'Acesso negado' });
  const { status } = req.body;
  if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Status inválido' });
  prepare('UPDATE campaign_join_requests SET status = ? WHERE id = ? AND campaign_id = ?')
    .run(status, req.params.requestId, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
