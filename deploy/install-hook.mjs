import { spawnSync } from 'node:child_process';
import { chmodSync } from 'node:fs';
function git(...args) {
  const result = spawnSync('git', args, { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(result.stderr || 'git configuration failed');
  return result.stdout.trim();
}
const current = spawnSync('git', ['config', '--get', 'core.hooksPath'], { encoding: 'utf8', windowsHide: true }).stdout.trim();
if (current && current !== '.githooks') throw new Error(`Existing hooks at ${current}; integrate post-commit there explicitly`);
chmodSync('.githooks/post-commit', 0o755);
git('config', 'core.hooksPath', '.githooks');
git('config', 'blog-to-post.autoDeploy', 'true');
console.log('Commit auto-deploy enabled for this checkout; SSH must be reachable.');
