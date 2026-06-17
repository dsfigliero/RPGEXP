const express = require('express');
const cors = require('cors');
const { initDb, prepare } = require('./database');
const { hashPassword } = require('./auth');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/characters', require('./routes/characters'));
app.use('/api/evaluation-items', require('./routes/evaluationItems'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/users', require('./routes/users'));

const PORT = process.env.PORT || 3001;

initDb().then(() => {
  // Seed admin
  const admin = prepare('SELECT id FROM users WHERE email = ?').get('admin@rpg.com');
  if (!admin) {
    prepare('INSERT INTO users (email, password_hash, is_admin) VALUES (?, ?, 1)')
      .run('admin@rpg.com', hashPassword('Admin@123'));
    console.log('Admin criado: admin@rpg.com / Admin@123');
  }

  app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
});
