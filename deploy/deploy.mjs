import { spawnSync } from 'node:child_process';
import { mkdirSync, copyFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
process.chdir(root);
function run(command, args, capture = false) {
  const result = spawnSync(command, args, { stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit', encoding: capture ? 'utf8' : undefined, windowsHide: true });
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})`);
  return result.stdout?.trim();
}
const target = process.env.BLOG_DEPLOY_HOST || 'erpan@urtopiaserver';
if (!/^[\w.@-]+$/.test(target)) throw new Error('Invalid SSH target');
const commit = run('git', ['rev-parse', 'HEAD'], true);
const working = process.argv.includes('--working-tree');
const revision = working ? `${commit.slice(0, 12)}-working-${Date.now()}` : commit;
const dir = path.join(root, 'deployment-artifacts');
mkdirSync(dir, { recursive: true });
const archive = path.join(dir, `${revision}.tar.gz`);
if (working) {
  const result = spawnSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error('Cannot enumerate source files');
  const files = [...new Set(result.stdout.split('\0').filter(Boolean))]
    .filter(f => !/^(\.git|\.wrangler|\.env|\.dev.vars|deployment-artifacts|node_modules|dist)(\/|$|\.)/.test(f));
  const stage = path.join(dir, `${revision}-source`);
  for (const file of files) {
    if (!statSync(file, { throwIfNoEntry: false })?.isFile()) continue;
    const destination = path.join(stage, file);
    mkdirSync(path.dirname(destination), { recursive: true });
    copyFileSync(file, destination);
  }
  run('tar', ['-czf', archive, '-C', stage, '.']);
} else run('git', ['archive', '--format=tar.gz', `--output=${archive}`, commit]);
const ssh = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15'];
run('ssh', [...ssh, target, 'mkdir -p /srv/projects/blog-to-post/incoming']);
run('scp', [...ssh, archive, `${target}:/srv/projects/blog-to-post/incoming/${revision}.tar.gz`]);
// Receive to a unique release. Existing releases, server secrets and data are never overlaid.
run('ssh', [...ssh, target, `mkdir -p /srv/projects/blog-to-post/releases/${revision} && tar -xzf /srv/projects/blog-to-post/incoming/${revision}.tar.gz -C /srv/projects/blog-to-post/releases/${revision} && bash /srv/projects/blog-to-post/releases/${revision}/deploy/server-deploy.sh ${revision}`]);
console.log(`Deployed ${revision}`);
