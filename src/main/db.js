import Database from 'better-sqlite3-multiple-ciphers';
import path from 'path';
import fs from 'fs';

let db;


export function normalizeDomain(input) {
  if (!input) return '';
  let domain = input.toLowerCase().trim();

  domain = domain.replace(/^https?:\/\//, '');


  if (domain.includes('@')) {
    domain = domain.split('@')[1];
  }

  domain = domain.replace(/^www\./, '');


  if (domain.includes('/')) {
    domain = domain.split('/')[0];
  }

  return domain;
}

export function initDatabase(userDataPath, password) {
  const dbDir = path.join(userDataPath, 'passkey-wallet');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = path.join(dbDir, 'passwords.db');

  db = new Database(dbPath);

  db.pragma(`key = '${password}'`);


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


const DOMAIN_ALIASES = {

  'mail.google.com': ['google.com', 'gmail.com', 'accounts.google.com'],
  'gmail.com': ['google.com', 'mail.google.com', 'accounts.google.com'],
  'accounts.google.com': ['google.com', 'gmail.com', 'mail.google.com'],
  'google.com': ['gmail.com', 'mail.google.com', 'accounts.google.com'],


  'login.microsoftonline.com': ['microsoft.com', 'outlook.com', 'live.com'],
  'outlook.com': ['microsoft.com', 'live.com', 'login.microsoftonline.com'],
  'outlook.live.com': ['microsoft.com', 'outlook.com', 'live.com'],
  'login.live.com': ['microsoft.com', 'outlook.com', 'live.com'],
  'microsoft.com': ['outlook.com', 'live.com', 'login.microsoftonline.com'],


  'facebook.com': ['fb.com', 'm.facebook.com'],
  'fb.com': ['facebook.com', 'm.facebook.com'],
  'm.facebook.com': ['facebook.com', 'fb.com'],


  'signin.aws.amazon.com': ['amazon.com', 'aws.amazon.com'],
  'aws.amazon.com': ['amazon.com', 'signin.aws.amazon.com'],


  'appleid.apple.com': ['apple.com', 'icloud.com'],
  'icloud.com': ['apple.com', 'appleid.apple.com'],


  'github.com': ['gist.github.com'],


  'twitter.com': ['x.com'],
  'x.com': ['twitter.com'],
};

export function getCredentials(query) {
  if (!db) throw new Error('DB not initialized');
  const allCreds = db.prepare('SELECT * FROM credentials').all();

  if (!query) return [];

  const lowerQuery = query.toLowerCase();


  const aliases = DOMAIN_ALIASES[lowerQuery] || [];



  const targets = [lowerQuery, ...aliases];


  return allCreds.filter(cred => {
    const domain = cred.domain.toLowerCase();


    return targets.some(target => {

      if (domain === target) return true;

      if (domain.includes(target)) return true;

      if (target.includes(domain)) return true;


      const domainBase = domain.split('.')[0];
      if (domainBase.length > 2 && target.includes(domainBase)) {
        return true;
      }


      const tokens = target.split(/[\s\-_]+/);
      for (const token of tokens) {
        if (token.length > 3 && domain.includes(token)) {
          return true;
        }
      }

      return false;
    });
  }).sort((a, b) => {

    if (targets.includes(a.domain)) return -1;
    return 0;
  });
}

export function addCredential(domain, username, password) {
  if (!db) throw new Error('DB not initialized');
  const cleanDomain = normalizeDomain(domain);
  const stmt = db.prepare('INSERT INTO credentials (domain, username, password) VALUES (?, ?, ?)');
  return stmt.run(cleanDomain, username, password);
}

export function getAllCredentials() {
  if (!db) throw new Error('DB not initialized');
  return db.prepare('SELECT * FROM credentials ORDER BY id DESC').all();
}

export function getCredentialsPage(page = 1, pageSize = 50) {
  if (!db) throw new Error('DB not initialized');
  const offset = (page - 1) * pageSize;

  const data = db.prepare('SELECT * FROM credentials ORDER BY id DESC LIMIT ? OFFSET ?').all(pageSize, offset);
  const countResult = db.prepare('SELECT COUNT(*) as count FROM credentials').get();

  return {
    data,
    total: countResult.count
  };
}

export function deleteCredential(id) {
  if (!db) throw new Error('DB not initialized');
  return db.prepare('DELETE FROM credentials WHERE id = ?').run(id);
}

/**
 * Delete all credentials from the database
 * @returns {{success: boolean, count: number}}
 */
export function deleteAllCredentials() {
  if (!db) throw new Error('DB not initialized');

  const stmt = db.prepare('SELECT COUNT(*) as count FROM credentials');
  const { count } = stmt.get();

  const deleteStmt = db.prepare('DELETE FROM credentials');
  deleteStmt.run();

  return { success: true, count };
}

export function updateCredential(id, domain, username, password) {
  if (!db) throw new Error('DB not initialized');
  const cleanDomain = normalizeDomain(domain);
  return db.prepare('UPDATE credentials SET domain = ?, username = ?, password = ? WHERE id = ?').run(cleanDomain, username, password, id);
}

export function findCredential(domain, username) {
  if (!db) throw new Error('DB not initialized');
  const clean = normalizeDomain(domain);
  return db.prepare('SELECT * FROM credentials WHERE domain = ? AND username = ?').get(clean, username);
}

export function checkDuplicates(rows) {
  if (!db) throw new Error('DB not initialized');
  const checkStmt = db.prepare('SELECT domain FROM credentials WHERE domain = ? AND username = ?');
  const duplicates = [];

  for (const row of rows) {
    const cleanDomain = normalizeDomain(row.domain);
    const exists = checkStmt.get(cleanDomain, row.username);
    if (exists) {
      duplicates.push(`${cleanDomain} (${row.username})`);
    }
  }
  return duplicates;
}

export function bulkInsertCredentials(rows) {
  if (!db) throw new Error('DB not initialized');

  const checkStmt = db.prepare('SELECT id FROM credentials WHERE domain = ? AND username = ?');
  const updateStmt = db.prepare('UPDATE credentials SET password = ? WHERE id = ?');
  const insertStmt = db.prepare('INSERT INTO credentials (domain, username, password) VALUES (?, ?, ?)');

  const insertMany = db.transaction((credentials) => {
    for (const cred of credentials) {
      const cleanDomain = normalizeDomain(cred.domain);
      const existing = checkStmt.get(cleanDomain, cred.username);

      if (existing) {

        updateStmt.run(cred.password, existing.id);
      } else {
        insertStmt.run(cleanDomain, cred.username, cred.password);
      }
    }
  });
  insertMany(rows);
}

export function closeDatabase() {
  if (db) {
    db.close();
    console.log('Database closed');
  }
}