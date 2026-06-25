const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb, prepare } = require('./database');
const { hashPassword } = require('./auth');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/characters', require('./routes/characters'));
app.use('/api/evaluation-items', require('./routes/evaluationItems'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/users', require('./routes/users'));
app.use('/api/classes', require('./routes/classes'));
app.use('/api/feats', require('./routes/feats'));
app.use('/api/monsters', require('./routes/monsters'));
app.use('/api/spell-library', require('./routes/spellLibrary'));

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.get('*', (req, res) =>
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'))
  );
}

const PORT = process.env.PORT || 3001;

initDb().then(() => {
  // Seed admin
  const admin = prepare('SELECT id FROM users WHERE email = ?').get('admin@rpg.com');
  if (!admin) {
    prepare('INSERT INTO users (email, password_hash, is_admin) VALUES (?, ?, 1)')
      .run('admin@rpg.com', hashPassword('Admin@123'));
    console.log('Admin criado: admin@rpg.com / Admin@123');
  }

  // Migra login legado sem @ para email válido
  const legacyDiegof = prepare('SELECT id FROM users WHERE email = ?').get('diegof');
  if (legacyDiegof) {
    prepare('UPDATE users SET email = ? WHERE email = ?').run('diegofigliero@gmail.com', 'diegof');
    console.log('Login migrado: diegof → diegofigliero@gmail.com');
  }

  const diegof = prepare('SELECT id FROM users WHERE email = ?').get('diegofigliero@gmail.com');
  if (!diegof) {
    prepare('INSERT INTO users (email, password_hash, is_admin) VALUES (?, ?, 1)')
      .run('diegofigliero@gmail.com', hashPassword('123456'));
    console.log('Admin criado: diegofigliero@gmail.com / 123456');
  }

  app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
});
