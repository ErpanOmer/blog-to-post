import { globSync, readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { Miniflare } from 'miniflare';
import { dataDir, root, runtimeOptions } from './config.mjs';

// Open and close the binding once so workerd creates its canonical database filename.
// All schema writes happen offline, before the public listener and scheduler start.
export async function migrate() {
  const setup = new Miniflare(runtimeOptions());
  try { await (await setup.getD1Database('DB')).prepare('SELECT 1').first(); }
  finally { await setup.dispose(); }
  const files = [...globSync(path.join(dataDir, 'd1/**/*.sqlite').replaceAll('\\', '/'))].filter(f => path.basename(f) !== 'metadata.sqlite');
  if (files.length !== 1) throw new Error(`Expected exactly one D1 database, found ${files.length}`);
  const db = new DatabaseSync(files[0]);
  try {
    db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 10000;');
    if (db.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw new Error('Database integrity check failed');
    const fresh = !db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='articles'").get();
    db.exec("CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)");
    const migrations = readdirSync(path.join(root, 'migrations')).filter(f => f.endsWith('.sql')).sort();
    db.exec('BEGIN IMMEDIATE');
    try {
      if (fresh) db.exec(readFileSync(path.join(root, 'src/worker/schema.sql'), 'utf8'));
      for (const name of migrations) {
        if (db.prepare('SELECT 1 FROM d1_migrations WHERE name = ?').get(name)) continue;
        // schema.sql is the baseline through 0012. Future migrations still run on fresh installs.
        if (!fresh || name > '0012_add_ai_provider_profiles.sql') db.exec(readFileSync(path.join(root, 'migrations', name), 'utf8'));
        db.prepare('INSERT INTO d1_migrations (name) VALUES (?)').run(name);
        console.log(`Migration recorded: ${name}`);
      }
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  } finally { db.close(); }
}
