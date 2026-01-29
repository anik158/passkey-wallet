import Database from 'better-sqlite3-multiple-ciphers';
import path from 'path';
import fs from 'fs';

let db;

export function initDatabase(userDataPath, password) {
  const dbDir = path.join(userDataPath, 'passkey-wallet');
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

export function getCredentials(query) {
  if (!db) throw new Error('DB not initialized');
  const allCreds = db.prepare('SELECT * FROM credentials').all();

  if (!query) return [];
  const lowerQuery = query.toLowerCase();

  // Fuzzy match logic - IN JS because SQL LIKE is too limited for "GitHub" vs "github.com"
  return allCreds.filter(cred => {
    const domain = cred.domain.toLowerCase();
    // 1. Exact match
    if (domain === lowerQuery) return true;
    // 2. Domain contains query (stored: github.com, query: github)
    if (domain.includes(lowerQuery)) return true;
    // 3. Query contains domain (stored: github.com, query: https://github.com/foo)
    if (lowerQuery.includes(domain)) return true;

    // 4. Smart Title Match (stored: github.com, query: "GitHub: Let's build...")
    // Check if the "base" of the domain is in the query title
    const domainBase = domain.split('.')[0]; // github
    // Avoid short matches like "co" from "co.uk" or "a" from "a.com"
    if (domainBase.length > 2 && lowerQuery.includes(domainBase)) {
      return true;
    }

    return false;
  }).sort((a, b) => {
    // Prioritize exact/better matches
    if (a.domain === lowerQuery) return -1;
    if (lowerQuery.includes(a.domain)) return -1;
    return 0;
  });
}

export function addCredential(domain, username, password) {
  if (!db) throw new Error('DB not initialized');
  const stmt = db.prepare('INSERT INTO credentials (domain, username, password) VALUES (?, ?, ?)');
  return stmt.run(domain, username, password);
}

export function getAllCredentials() {
  if (!db) throw new Error('DB not initialized');
  return db.prepare('SELECT * FROM credentials ORDER BY domain ASC').all();
}

export function deleteCredential(id) {
  if (!db) throw new Error('DB not initialized');
  return db.prepare('DELETE FROM credentials WHERE id = ?').run(id);
}

export function updateCredential(id, username, password) {
  if (!db) throw new Error('DB not initialized');
  return db.prepare('UPDATE credentials SET username = ?, password = ? WHERE id = ?').run(username, password, id);
}

export function bulkInsertCredentials(rows) {
  if (!db) throw new Error('DB not initialized');
  const insert = db.prepare('INSERT INTO credentials (domain, username, password) VALUES (@domain, @username, @password)');
  const insertMany = db.transaction((credentials) => {
    for (const cred of credentials) insert.run(cred);
  });
  insertMany(rows);
}

export function closeDatabase() {
  if (db) {
    db.close();
    console.log('Database closed');
  }
}