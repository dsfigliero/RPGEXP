const express = require('express');
const router = express.Router();
const { prepare } = require('../database');
const { hashPassword, verifyPassword, generateToken } = require('../auth');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/register', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email e senha obrigatórios' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Email inválido' });
  const existing = prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(400).json({ error: 'Email já cadastrado' });
  const hash = hashPassword(password);
  const result = prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(email, hash);
  const user = prepare('SELECT id, email, is_admin FROM users WHERE id = ?').get(result.lastInsertRowid);
  res.json({ token: generateToken(user), user });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !verifyPassword(password, user.password_hash))
    return res.status(401).json({ error: 'Email ou senha incorretos' });
  const { password_hash, ...safeUser } = user;
  res.json({ token: generateToken(safeUser), user: safeUser });
});

module.exports = router;
