import { cp, mkdir, readdir, stat } from 'node:fs/promises';
import { DatabaseSync, backup } from 'node:sqlite';
import path from 'node:path';

// Quiesce writers first when taking the final cross-store migration snapshot.
const source = path.resolve(process.argv[2] || '.wrangler/state/v3');
const destination = path.resolve(process.argv[3] || `deployment-artifacts/state-${Date.now()}`);
if (source === destination || destination.startsWith(source + path.sep)) throw new Error('Snapshot must be outside source');
try { await stat(destination); throw new Error('Snapshot destination already exists'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await mkdir(destination, { recursive: true });
async function copyDirectory(from, to) {
  await mkdir(to, { recursive: true });
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name), dest = path.join(to, entry.name);
    if (entry.isDirectory()) await copyDirectory(src, dest);
    else if (entry.name.endsWith('.sqlite')) {
      const db = new DatabaseSync(src, { readOnly: true });
      try { await backup(db, dest); } finally { db.close(); }
      const check = new DatabaseSync(dest, { readOnly: true });
      try { if (check.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw new Error(`Integrity failed: ${entry.name}`); }
      finally { check.close(); }
    } else if (!entry.name.endsWith('-wal') && !entry.name.endsWith('-shm')) await cp(src, dest);
  }
}
await copyDirectory(source, destination);
console.log(`Consistent SQLite snapshots and blob files saved to ${destination}`);
