const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'data', 'rpg.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

let db;

function saveDb() {
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
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      level INTEGER DEFAULT 1,
      total_xp INTEGER DEFAULT 0,
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
      is_finalized INTEGER DEFAULT 0
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
  `);

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
    db.run('BEGIN');
    try {
      fn(...args);
      db.run('COMMIT');
      saveDb();
    } catch (e) {
      db.run('ROLLBACK');
      throw e;
    }
  };
}

module.exports = { initDb, prepare, exec, transaction };
