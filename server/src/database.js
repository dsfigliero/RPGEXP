const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'rpg.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

let db;
let inTransaction = false;

function saveDb() {
  if (inTransaction) return;
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

async function initDb() {
  const SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`PRAGMA foreign_keys = ON;`);

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      is_mestre INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      is_public INTEGER DEFAULT 0,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS campaign_join_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(campaign_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      class TEXT DEFAULT '',
      level INTEGER DEFAULT 1,
      total_xp INTEGER DEFAULT 0,
      hp INTEGER DEFAULT 0,
      max_hp INTEGER DEFAULT 0,
      ac INTEGER DEFAULT 10,
      initiative INTEGER DEFAULT 0,
      str_score INTEGER DEFAULT 10,
      dex_score INTEGER DEFAULT 10,
      con_score INTEGER DEFAULT 10,
      int_score INTEGER DEFAULT 10,
      wis_score INTEGER DEFAULT 10,
      cha_score INTEGER DEFAULT 10,
      race TEXT DEFAULT '',
      alignment TEXT DEFAULT '',
      speed INTEGER DEFAULT 30,
      bab INTEGER DEFAULT 0,
      cmb INTEGER DEFAULT 0,
      cmd INTEGER DEFAULT 10,
      spell_resistance INTEGER DEFAULT 0,
      fortitude INTEGER DEFAULT 0,
      will_save INTEGER DEFAULT 0,
      reflex INTEGER DEFAULT 0,
      char_notes TEXT DEFAULT '',
      user_id INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS evaluation_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      xp_value INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      date TEXT DEFAULT (datetime('now')),
      is_finalized INTEGER DEFAULT 0,
      campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS session_participants (
      session_id INTEGER NOT NULL,
      character_id INTEGER NOT NULL,
      PRIMARY KEY (session_id, character_id),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS session_character_evaluation_items (
      session_id INTEGER NOT NULL,
      character_id INTEGER NOT NULL,
      evaluation_item_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      PRIMARY KEY (session_id, character_id, evaluation_item_id),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (evaluation_item_id) REFERENCES evaluation_items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS xp_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      character_id INTEGER NOT NULL,
      xp_granted INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES sessions(id),
      FOREIGN KEY (character_id) REFERENCES characters(id)
    );

    CREATE TABLE IF NOT EXISTS character_effects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
      session_id INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      effect_type TEXT DEFAULT 'other',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS npc_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      hp INTEGER DEFAULT 0,
      max_hp INTEGER DEFAULT 0,
      ac INTEGER DEFAULT 10,
      initiative INTEGER DEFAULT 0,
      notes TEXT DEFAULT '',
      attacks TEXT DEFAULT '[]',
      monster_data TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS character_change_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
      changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      changed_by_email TEXT DEFAULT '',
      old_values TEXT DEFAULT '{}',
      new_values TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS combat_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      target_character_id INTEGER REFERENCES characters(id) ON DELETE SET NULL,
      target_name TEXT NOT NULL DEFAULT '',
      attacker_name TEXT DEFAULT '',
      attack_name TEXT DEFAULT '',
      roll_notation TEXT DEFAULT '',
      roll_result INTEGER DEFAULT 0,
      damage_dealt INTEGER DEFAULT 0,
      hp_before INTEGER DEFAULT 0,
      hp_after INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS character_classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      uses_magic INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS feats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS character_feats (
      character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
      feat_id INTEGER NOT NULL REFERENCES feats(id) ON DELETE CASCADE,
      PRIMARY KEY (character_id, feat_id)
    );

    CREATE TABLE IF NOT EXISTS monster_library (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      hp INTEGER DEFAULT 0,
      max_hp INTEGER DEFAULT 0,
      ac INTEGER DEFAULT 10,
      initiative INTEGER DEFAULT 0,
      notes TEXT DEFAULT '',
      attacks TEXT DEFAULT '[]',
      monster_data TEXT DEFAULT NULL,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS character_known_spells (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      circle INTEGER NOT NULL DEFAULT 0,
      school TEXT DEFAULT '',
      description TEXT DEFAULT '',
      components TEXT DEFAULT '',
      casting_time TEXT DEFAULT '',
      duration TEXT DEFAULT '',
      range TEXT DEFAULT '',
      saving_throw TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS character_spell_slots (
      character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
      circle INTEGER NOT NULL,
      total_slots INTEGER DEFAULT 0,
      used_slots INTEGER DEFAULT 0,
      PRIMARY KEY (character_id, circle)
    );

    CREATE TABLE IF NOT EXISTS character_prepared_spells (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
      known_spell_id INTEGER REFERENCES character_known_spells(id) ON DELETE SET NULL,
      circle INTEGER NOT NULL,
      spell_name TEXT NOT NULL,
      is_cast INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS spell_library (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      display_name TEXT,
      school TEXT DEFAULT '',
      subschool TEXT DEFAULT '',
      descriptors TEXT DEFAULT '[]',
      levels TEXT DEFAULT '[]',
      casting_time TEXT DEFAULT '',
      components TEXT DEFAULT '{}',
      range TEXT DEFAULT '',
      area TEXT DEFAULT '',
      effect TEXT DEFAULT '',
      target TEXT DEFAULT '',
      duration TEXT DEFAULT '',
      saving_throw TEXT DEFAULT '{}',
      spell_resistance TEXT DEFAULT '{}',
      description_short TEXT DEFAULT '',
      description_full TEXT DEFAULT '',
      source TEXT DEFAULT '{}',
      raw_data TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  try { db.run(`ALTER TABLE characters ADD COLUMN class TEXT DEFAULT ''`); } catch(e) {}
  try { db.run(`ALTER TABLE sessions ADD COLUMN campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL`); } catch(e) {}
  try { db.run(`ALTER TABLE campaigns ADD COLUMN is_public INTEGER DEFAULT 0`); } catch(e) {}
  try { db.run(`ALTER TABLE campaigns ADD COLUMN created_by INTEGER REFERENCES users(id) ON DELETE SET NULL`); } catch(e) {}
  try { db.run(`ALTER TABLE characters ADD COLUMN hp INTEGER DEFAULT 0`); } catch(e) {}
  try { db.run(`ALTER TABLE characters ADD COLUMN max_hp INTEGER DEFAULT 0`); } catch(e) {}
  try { db.run(`ALTER TABLE characters ADD COLUMN ac INTEGER DEFAULT 10`); } catch(e) {}
  try { db.run(`ALTER TABLE characters ADD COLUMN initiative INTEGER DEFAULT 0`); } catch(e) {}
  try { db.run(`ALTER TABLE characters ADD COLUMN str_score INTEGER DEFAULT 10`); } catch(e) {}
  try { db.run(`ALTER TABLE characters ADD COLUMN dex_score INTEGER DEFAULT 10`); } catch(e) {}
  try { db.run(`ALTER TABLE characters ADD COLUMN con_score INTEGER DEFAULT 10`); } catch(e) {}
  try { db.run(`ALTER TABLE characters ADD COLUMN int_score INTEGER DEFAULT 10`); } catch(e) {}
  try { db.run(`ALTER TABLE characters ADD COLUMN wis_score INTEGER DEFAULT 10`); } catch(e) {}
  try { db.run(`ALTER TABLE characters ADD COLUMN cha_score INTEGER DEFAULT 10`); } catch(e) {}
  try { db.run(`ALTER TABLE characters ADD COLUMN race TEXT DEFAULT ''`); } catch(e) {}
  try { db.run(`ALTER TABLE characters ADD COLUMN alignment TEXT DEFAULT ''`); } catch(e) {}
  try { db.run(`ALTER TABLE characters ADD COLUMN speed INTEGER DEFAULT 30`); } catch(e) {}
  try { db.run(`ALTER TABLE characters ADD COLUMN bab INTEGER DEFAULT 0`); } catch(e) {}
  try { db.run(`ALTER TABLE characters ADD COLUMN cmb INTEGER DEFAULT 0`); } catch(e) {}
  try { db.run(`ALTER TABLE characters ADD COLUMN cmd INTEGER DEFAULT 10`); } catch(e) {}
  try { db.run(`ALTER TABLE characters ADD COLUMN spell_resistance INTEGER DEFAULT 0`); } catch(e) {}
  try { db.run(`ALTER TABLE characters ADD COLUMN fortitude INTEGER DEFAULT 0`); } catch(e) {}
  try { db.run(`ALTER TABLE characters ADD COLUMN will_save INTEGER DEFAULT 0`); } catch(e) {}
  try { db.run(`ALTER TABLE characters ADD COLUMN reflex INTEGER DEFAULT 0`); } catch(e) {}
  try { db.run(`ALTER TABLE characters ADD COLUMN char_notes TEXT DEFAULT ''`); } catch(e) {}
  try { db.run(`ALTER TABLE npc_cards ADD COLUMN attacks TEXT DEFAULT '[]'`); } catch(e) {}
  try { db.run(`ALTER TABLE npc_cards ADD COLUMN monster_data TEXT DEFAULT NULL`); } catch(e) {}
  try { db.run(`ALTER TABLE users ADD COLUMN is_mestre INTEGER DEFAULT 0`); } catch(e) {}
  try { db.run(`ALTER TABLE session_participants ADD COLUMN encounter_initiative INTEGER DEFAULT NULL`); } catch(e) {}
  try { db.run(`ALTER TABLE sessions ADD COLUMN show_hp_to_players INTEGER DEFAULT 1`); } catch(e) {}
  try { db.run(`ALTER TABLE characters ADD COLUMN class_id INTEGER REFERENCES character_classes(id) ON DELETE SET NULL`); } catch(e) {}
  try { db.run(`ALTER TABLE character_classes ADD COLUMN casting_type TEXT DEFAULT 'prepared'`); } catch(e) {}
  try { db.run(`ALTER TABLE sessions ADD COLUMN spells_locked INTEGER DEFAULT 0`); } catch(e) {}
  try { db.run(`ALTER TABLE character_known_spells ADD COLUMN times_cast INTEGER DEFAULT 0`); } catch(e) {}

  // Seed default users (only if they don't exist)
  const { hashPassword } = require('./auth');
  const seedUsers = [
    { email: 'd@gmail.com',     is_admin: 0, is_mestre: 0 },
    { email: 'v@gmail.com',     is_admin: 0, is_mestre: 0 },
    { email: 'j@gmail.com',     is_admin: 0, is_mestre: 0 },
    { email: 'diego@gmail.com', is_admin: 0, is_mestre: 0 },
    { email: 'm@gmail.com',     is_admin: 0, is_mestre: 1 },
  ];
  for (const u of seedUsers) {
    const exists = prepare('SELECT id FROM users WHERE email = ?').get(u.email);
    if (!exists) {
      const hash = hashPassword('1');
      db.run('INSERT INTO users (email, password_hash, is_admin, is_mestre) VALUES (?, ?, ?, ?)', [u.email, hash, u.is_admin, u.is_mestre]);
    }
  }

  // Seed character classes
  const seedClasses = [
    { name: 'Mago',       description: 'Conjurador arcano de grande poder intelectual',       uses_magic: 1 },
    { name: 'Feiticeiro', description: 'Conjurador arcano de poder inato e natural',           uses_magic: 1 },
    { name: 'Bardo',      description: 'Conjurador versátil que mistura magia e performance',  uses_magic: 1 },
    { name: 'Guerreiro',  description: 'Combatente treinado em armas e armaduras',             uses_magic: 0 },
    { name: 'Ladino',     description: 'Especialista em furtividade, armadilhas e perícias',   uses_magic: 0 },
  ];
  for (const c of seedClasses) {
    const exists = prepare('SELECT id FROM character_classes WHERE name = ?').get(c.name);
    if (!exists) {
      db.run('INSERT INTO character_classes (name, description, uses_magic) VALUES (?, ?, ?)', [c.name, c.description, c.uses_magic]);
    }
  }

  // Update casting_type for existing seeded classes
  const castingTypes = {
    'Mago': 'prepared',
    'Feiticeiro': 'spontaneous',
    'Bardo': 'spontaneous',
    'Guerreiro': 'none',
    'Ladino': 'none',
  };
  for (const [name, type] of Object.entries(castingTypes)) {
    db.run('UPDATE character_classes SET casting_type = ? WHERE name = ?', [type, name]);
  }

  // Seed feats
  const seedFeats = [
    { name: 'Iniciativa Aprimorada', description: '+4 na iniciativa' },
  ];
  for (const f of seedFeats) {
    const exists = prepare('SELECT id FROM feats WHERE name = ?').get(f.name);
    if (!exists) {
      db.run('INSERT INTO feats (name, description) VALUES (?, ?)', [f.name, f.description]);
    }
  }

  saveDb();
  return db;
}

// Wrapper síncrono estilo better-sqlite3
function prepare(sql) {
  return {
    run(...params) {
      db.run(sql, params);
      const row = db.exec("SELECT last_insert_rowid() as id")[0];
      const lastInsertRowid = row ? row.values[0][0] : null;
      saveDb();
      return { lastInsertRowid };
    },
    get(...params) {
      const result = db.exec(sql, params);
      if (!result[0]) return undefined;
      const { columns, values } = result[0];
      if (!values[0]) return undefined;
      return Object.fromEntries(columns.map((c, i) => [c, values[0][i]]));
    },
    all(...params) {
      const result = db.exec(sql, params);
      if (!result[0]) return [];
      const { columns, values } = result[0];
      return values.map(row => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
    }
  };
}

function exec(sql) {
  db.run(sql);
  saveDb();
}

function transaction(fn) {
  return function(...args) {
    inTransaction = true;
    db.run('BEGIN');
    try {
      fn(...args);
      db.run('COMMIT');
    } catch (e) {
      try { db.run('ROLLBACK'); } catch (_) {}
      inTransaction = false;
      throw e;
    }
    inTransaction = false;
    saveDb();
  };
}

module.exports = { initDb, prepare, exec, transaction };
