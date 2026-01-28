import Database from 'better-sqlite3-multiple-ciphers';
import path from 'path';
import fs from 'fs';

let db;

export function initDatabase(userDataPath, password) {
  const dbDir = path.join(userDataPath, 'quickpass');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = path.join(dbDir, 'passwords.db');

  db = new Database(dbPath, { verbose: console.log });

  // Set encryption key
  db.pragma(`key = '${password}'`);

  // Verify encryption/ create table
  db.exec(`
    CREATE TABLE IF NOT EXISTS credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT NOT NULL,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_domain ON credentials(domain);
  `);

  console.log('Database initialized at', dbPath);
}

export function getCredentials(domain) {
  if (!db) throw new Error('DB not initialized');
  // Simple substring match for now, can be improved
  const stmt = db.prepare('SELECT * FROM credentials WHERE domain LIKE ?');
  return stmt.all(`%${domain}%`);
}

export function addCredential(domain, username, password) {
  if (!db) throw new Error('DB not initialized');
  const stmt = db.prepare('INSERT INTO credentials (domain, username, password) VALUES (?, ?, ?)');
  return stmt.run(domain, username, password);
}

export function closeDatabase() {
  if (db) {
    db.close();
    console.log('Database closed');
  }
}