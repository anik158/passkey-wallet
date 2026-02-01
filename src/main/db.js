import Database from 'better-sqlite3-multiple-ciphers';
import path from 'path';
import fs from 'fs';

let db;

// Helper to normalize domains
function normalizeDomain(input) {
  if (!input) return '';
  let domain = input.toLowerCase().trim();

  // Remove protocol
  domain = domain.replace(/^https?:\/\//, '');

  // Remove user/pass if present (basic)
  // e.g. https://user:pass@example.com -> example.com
  if (domain.includes('@')) {
    domain = domain.split('@')[1];
  }

  // Remove www.
  domain = domain.replace(/^www\./, '');

  // Remove trailing paths
  // example.com/login -> example.com
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

// Common login redirects
const DOMAIN_ALIASES = {
  'login.microsoftonline.com': ['outlook.com', 'live.com', 'microsoft.com', 'office.com'],
  'accounts.google.com': ['google.com', 'gmail.com', 'youtube.com'],
  'amazon.com': ['aws.amazon.com', 'smile.amazon.com'],
  'github.com': ['github.io']
};

export function getCredentials(query) {
  if (!db) throw new Error('DB not initialized');
  const allCreds = db.prepare('SELECT * FROM credentials').all();

  if (!query) return [];

  const lowerQuery = query.toLowerCase();

  // Expand query with aliases
  // If query is 'login.microsoftonline.com', we also want to match 'outlook.com', etc.
  const aliases = DOMAIN_ALIASES[lowerQuery] || [];

  // Check if query implies a broader reverse alias (simple check)
  // e.g. if query is 'outlook.com', we might not need to look for microsoftonline, 
  // but usually it's the Login Page (query) -> Saved Cred (target).

  const targets = [lowerQuery, ...aliases];

  // Fuzzy match logic
  return allCreds.filter(cred => {
    const domain = cred.domain.toLowerCase();

    // Check against all possible targets (query + aliases)
    return targets.some(target => {
      // 1. Exact match
      if (domain === target) return true;
      // 2. Domain contains target
      if (domain.includes(target)) return true;
      // 3. Target contains domain
      if (target.includes(domain)) return true;

      // 4. Smart Title Match / Base Match
      const domainBase = domain.split('.')[0];
      if (domainBase.length > 2 && target.includes(domainBase)) {
        return true;
      }

      // 5. Token Match (e.g. "Google Account" -> "google.com")
      const tokens = target.split(/[\s\-_]+/);
      for (const token of tokens) {
        if (token.length > 3 && domain.includes(token)) {
          return true;
        }
      }

      return false;
    });
  }).sort((a, b) => {
    // Prioritize exact/better matches
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

export function updateCredential(id, username, password) {
  // We aren't updating domain currently in UI, but if we did, we'd normalize it too.
  // The current UI sends { id, domain, username, password } but domain is disabled.
  // If we enable domain edit later, we should handle it.
  // For now the SQL only updates username/password.
  if (!db) throw new Error('DB not initialized');
  return db.prepare('UPDATE credentials SET username = ?, password = ? WHERE id = ?').run(username, password, id);
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
        // Update existing entry (Upsert behavior) ensures we don't get duplicates
        // and that we update passwords if they changed in the imported file.
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