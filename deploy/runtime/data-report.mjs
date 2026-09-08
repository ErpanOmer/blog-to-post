import { globSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createHash, webcrypto } from 'node:crypto';
import path from 'node:path';

const dir = path.resolve(process.env.DATA_DIR || process.argv[2] || '.wrangler/state/v3');
const hash = value => createHash('sha256').update(value).digest('hex');
const report = { tables: {}, blobs: {}, credentials: { encrypted: 0, decrypted: 0 } };
for (const file of globSync(path.join(dir, '**/*.sqlite').replaceAll('\\', '/'))) {
  if (path.basename(file) === 'metadata.sqlite') continue;
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    if (db.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw new Error('Database integrity check failed');
    for (const { name } of db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()) {
      if (name.startsWith('_cf_') || name === 'sqlite_sequence' || name === 'd1_migrations') continue;
      const rows = db.prepare('SELECT * FROM "' + name.replaceAll('"', '""') + '"').all();
      const canonical = rows.map(row => JSON.stringify(row)).sort().join('\n');
      report.tables[name] = { count: rows.length, sha256: hash(canonical) };
      if (process.env.ENCRYPTION_KEY && ['platform_accounts', 'ai_provider_profiles'].includes(name)) {
        for (const row of rows) {
          const value = row.authToken || row.apiKeyCiphertext;
          if (!value || !/^[a-f0-9]{24}:[a-f0-9]+$/i.test(value)) continue;
          report.credentials.encrypted++;
          const [iv, encrypted] = value.split(':');
          const key = await webcrypto.subtle.importKey('raw', Buffer.from(process.env.ENCRYPTION_KEY, 'hex'), 'AES-GCM', false, ['decrypt']);
          await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(iv, 'hex') }, key, Buffer.from(encrypted, 'hex'));
          report.credentials.decrypted++;
        }
      }
    }
  } finally { db.close(); }
}
for (const file of globSync(path.join(dir, '**/blobs/**/*').replaceAll('\\', '/'), { withFileTypes: true })) {
  if (!file.isFile()) continue;
  const full = path.join(file.parentPath, file.name);
  report.blobs[path.relative(dir, full).replaceAll('\\', '/')] = hash(readFileSync(full));
}
console.log(JSON.stringify(report, null, 2));
