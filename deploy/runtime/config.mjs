import { readFileSync } from 'node:fs';
import path from 'node:path';

export const root = path.resolve(import.meta.dirname, '../..');
export const workerConfig = JSON.parse(readFileSync(path.join(root, 'dist/blog_to_post/wrangler.json'), 'utf8'));
export const dataDir = path.resolve(process.env.DATA_DIR || path.join(root, '.wrangler/state/v3'));

export function runtimeOptions() {
  const bindings = { ...workerConfig.vars };
  for (const key of ['ENVIRONMENT', 'ENCRYPTION_KEY', 'WEBSITE_BASE_URL', 'WEBSITE_ADMIN_TOKEN', 'WECHAT_RELAY_BASE_URL', 'WECHAT_RELAY_API_KEY']) {
    if (process.env[key] !== undefined) bindings[key] = process.env[key];
  }
  return {
    name: workerConfig.name,
    modules: true,
    scriptPath: path.join(root, 'dist/blog_to_post/index.js'),
    compatibilityDate: workerConfig.compatibility_date,
    compatibilityFlags: workerConfig.compatibility_flags,
    bindings,
    host: '127.0.0.1',
    port: 0,
    cf: false,
    d1Databases: Object.fromEntries(workerConfig.d1_databases.map(x => [x.binding, x.database_id])),
    kvNamespaces: Object.fromEntries(workerConfig.kv_namespaces.map(x => [x.binding, x.id])),
    r2Buckets: Object.fromEntries(workerConfig.r2_buckets.map(x => [x.binding, x.bucket_name])),
    d1Persist: path.join(dataDir, 'd1'),
    kvPersist: path.join(dataDir, 'kv'),
    r2Persist: path.join(dataDir, 'r2'),
    cachePersist: path.join(dataDir, 'cache'),
    assets: {
      directory: path.join(root, 'dist/client'),
      routerConfig: { has_user_worker: true, static_routing: { user_worker: ['/api', '/api/*'] } },
      assetConfig: { not_found_handling: 'single-page-application' },
    },
  };
}
