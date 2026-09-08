import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, cpSync, writeFileSync, readFileSync, globSync, chmodSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Miniflare } from 'miniflare';
import { runtimeOptions } from '../runtime/config.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const fixture = path.join(root, 'deployment-artifacts', `integration-${Date.now()}`);
mkdirSync(fixture, { recursive: true });
for (const file of ['deploy/runtime', 'migrations', 'src/worker/schema.sql', 'dist/client', 'dist/blog_to_post/index.js', 'dist/blog_to_post/wrangler.json']) {
  const dest = path.join(fixture, file);
  mkdirSync(path.dirname(dest), { recursive: true });
  cpSync(path.join(root, file), dest, { recursive: true });
}
const data = path.join(fixture, 'data');
const port = 18476;
const base = `http://127.0.0.1:${port}`;
let child;
let output = '';
const env = { ...process.env, ENCRYPTION_KEY: 'ab'.repeat(32), ENVIRONMENT: 'production', DATA_DIR: data, PORT: String(port), HOST: '127.0.0.1', DISABLE_SCHEDULED: 'true' };
function launch() {
  output = '';
  child = spawn(process.execPath, ['deploy/runtime/server.mjs'], { cwd: fixture, env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  child.stdout.on('data', d => { output += d; });
  child.stderr.on('data', d => { output += d; });
  return child;
}
async function start() {
  launch();
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(output);
    if (output.includes('Blog-to-Post ready')) return;
    await delay(100);
  }
  throw new Error('Server did not start: ' + output);
}
async function stop() {
  if (!child || child.exitCode !== null) return;
  // A normal signal reaches the supervisor on POSIX. Windows cannot deliver SIGTERM,
  // so stop the fixture's full process tree there, then verify WAL recovery on restart.
  const exited = new Promise(resolve => child.once('exit', resolve));
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' });
  else child.kill('SIGTERM');
  await exited;
}
async function json(url, method = 'GET', body) {
  const r = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  assert.equal(r.status, 200, `${method} ${url}`);
  return r.json();
}

test('D1 + KV + R2 survive restart; failed migration rolls back', { timeout: 60000 }, async t => {
  t.after(stop);
  await start();
  assert.equal((await json('/api/articles')).length, 0);
  const a = await json('/api/articles', 'POST', { title: '持久化验证', content: '# Unicode ✓', tags: ['测试'] });
  await json(`/api/articles/${a.id}`, 'PUT', { content: '# Unicode ✓\nUpdated' });
  await json('/api/ai/prompts/title', 'PUT', { template: 'Persistent prompt ✓' });
  assert.equal((await fetch(base + '/__scheduled')).status, 404);
  assert.equal((await fetch(base + '/api/missing')).status, 404);
  assert.match(await (await fetch(base + '/deep/link')).text(), /<div id="root">/);
  await stop();
  await start();
  assert.equal((await json(`/api/articles/${a.id}`)).content, '# Unicode ✓\nUpdated');
  assert.equal((await json('/api/articles')).length, 1);
  await stop();

  const options = runtimeOptions();
  const mf = new Miniflare({ ...options, d1Persist: path.join(data, 'd1'), kvPersist: path.join(data, 'kv'), r2Persist: path.join(data, 'r2'), cachePersist: path.join(data, 'cache') });
  try {
    assert.equal(await (await mf.getKVNamespace('PROMPTS')).get('prompt:title'), 'Persistent prompt ✓');
    const object = await (await mf.getR2Bucket('DRAFTS')).get(`drafts/${a.id}.md`);
    assert.equal(await object.text(), '# Unicode ✓\nUpdated');
  } finally { await mf.dispose(); }

  writeFileSync(path.join(fixture, 'migrations/0013_deliberate_failure.sql'), 'ALTER TABLE articles ADD COLUMN rollback_probe TEXT; SELECT * FROM nonexistent_probe_table;');
  launch();
  const code = await new Promise(resolve => child.once('exit', resolve));
  assert.notEqual(code, 0);
  assert.match(output, /nonexistent_probe_table/);
  const dbFile = globSync(path.join(data, 'd1/**/*.sqlite').replaceAll('\\', '/')).find(f => path.basename(f) !== 'metadata.sqlite');
  const db = new DatabaseSync(dbFile, { readOnly: true });
  try {
    assert.equal(db.prepare('PRAGMA table_info(articles)').all().some(c => c.name === 'rollback_probe'), false);
    assert.equal(db.prepare('SELECT count(*) n FROM articles').get().n, 1);
    assert.equal(db.prepare('SELECT count(*) n FROM d1_migrations').get().n, 12);
  } finally { db.close(); }
});

test('actual Git commit invokes the opt-in post-commit hook', () => {
  const dir = path.join(fixture, 'hook-repo');
  mkdirSync(path.join(dir, '.githooks'), { recursive: true });
  mkdirSync(path.join(dir, 'deploy'), { recursive: true });
  cpSync(path.join(root, '.githooks/post-commit'), path.join(dir, '.githooks/post-commit'));
  chmodSync(path.join(dir, '.githooks/post-commit'), 0o755);
  writeFileSync(path.join(dir, 'deploy/deploy.mjs'), "import{writeFileSync}from'node:fs';import{execFileSync}from'node:child_process';writeFileSync('hook-ran',execFileSync('git',['rev-parse','HEAD']));");
  function git(...args) {
    const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8', windowsHide: true });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  }
  git('init');
  git('config', 'core.hooksPath', '.githooks');
  git('config', 'blog-to-post.autoDeploy', 'true');
  git('add', '.');
  git('-c', 'user.name=Deployment Test', '-c', 'user.email=deployment-test@localhost', 'commit', '-m', 'Verify deployment hook');
  assert.equal(readFileSync(path.join(dir, 'hook-ran'), 'utf8').trim(), git('rev-parse', 'HEAD'));
});
