import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { Miniflare } from 'miniflare';
import { runtimeOptions, workerConfig } from './config.mjs';
import { migrate } from './migrate.mjs';

if (!/^[a-f0-9]{64}$/i.test(process.env.ENCRYPTION_KEY || '')) {
  throw new Error('Supply the original ENCRYPTION_KEY (64 hex characters) in the runtime env file');
}
const crons = workerConfig.triggers?.crons || [];
if (crons.some(cron => cron !== '*/30 * * * *')) {
  throw new Error('Unsupported cron expression; explicitly implement it before enabling it on this server');
}
await migrate();
const mf = new Miniflare(runtimeOptions());
await mf.ready;
const db = await mf.getD1Database('DB');
const worker = await mf.getWorker();
let stopping = false;
let scheduledRun = null;
let lastScheduledMinute = '';

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (stopping) { res.writeHead(503, { 'Connection': 'close' }).end(); return; }
    if (url.pathname === '/__health') {
      if (stopping) { res.writeHead(503).end(); return; }
      await db.prepare('SELECT count(*) FROM articles').first();
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ status: 'ok', revision: process.env.DEPLOY_REVISION || 'local' }));
      return;
    }
    // Keep Miniflare control/debug endpoints on its private loopback listener.
    if (url.pathname.startsWith('/__')) { res.writeHead(404).end(); return; }
    const controller = new AbortController();
    res.on('close', () => { if (!res.writableFinished) controller.abort(); });
    const init = { method: req.method, headers: req.headers, signal: controller.signal };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      init.body = Readable.toWeb(req);
      init.duplex = 'half';
    }
    const response = await mf.dispatchFetch(url, init);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) await pipeline(Readable.fromWeb(response.body), res);
    else res.end();
  } catch (error) {
    if (req.destroyed || res.destroyed) return;
    console.error('HTTP request failed:', error.name);
    if (!res.headersSent) res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: 'Service unavailable' }));
  }
});
server.requestTimeout = 300_000;
server.listen(Number(process.env.PORT || 18473), process.env.HOST || '127.0.0.1', () => console.log('Blog-to-Post ready'));

const scheduler = setInterval(() => {
  const now = new Date();
  const minute = now.toISOString().slice(0, 16);
  if (stopping || scheduledRun || !crons.length || process.env.DISABLE_SCHEDULED === 'true' || now.getUTCMinutes() % 30 !== 0 || minute === lastScheduledMinute) return;
  lastScheduledMinute = minute;
  scheduledRun = worker.scheduled({ cron: '*/30 * * * *', scheduledTime: now.getTime() })
    .catch(error => console.error('Scheduled handler failed:', error.name))
    .finally(() => { scheduledRun = null; });
}, 1000);

async function shutdown() {
  if (stopping) return;
  stopping = true;
  clearInterval(scheduler);
  const deadline = setTimeout(() => process.exit(1), 290_000);
  deadline.unref();
  await new Promise(resolve => server.close(resolve));
  if (scheduledRun) await scheduledRun;
  // Publish work continues via waitUntil after the HTTP response has completed.
  // Allow those jobs to finish before closing the Worker runtime and backing up its stores.
  while ((await db.prepare("SELECT count(*) AS n FROM publish_tasks WHERE status = 'processing'").first()).n > 0) {
    await delay(1000);
  }
  await mf.dispose();
  clearTimeout(deadline);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
