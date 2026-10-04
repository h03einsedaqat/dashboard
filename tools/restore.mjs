/**
 * NOVAADMIN — sandbox restore
 * ------------------------------------------------------------------
 * The Arena sandbox keeps only the tracked sources between turns: installed
 * dependencies (`node_modules/`) and the generated `src/pages/` folder are
 * dropped, which is why the dev server is down when a new turn starts.
 *
 * This script puts the checkout back on the pushed HEAD of the current branch
 * and reinstalls dependencies, so `npm run dev` (which regenerates every page,
 * asset and navigation file) can start immediately:
 *
 *   npm run restore && npm run dev
 *
 * Safety: it refuses to discard uncommitted work — pass `--force` when the
 * working tree is intentionally disposable.
 */
import { execSync } from 'node:child_process';

const force = process.argv.includes('--force');
const run = (command) => execSync(command, { stdio: 'inherit' });

const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
const dirty = execSync('git status --porcelain', { encoding: 'utf8' }).trim();

if (dirty && !force) {
  console.error(`\n  ✖ ${dirty.split('\n').length} uncommitted change(s) in the working tree.`);
  console.error('    Commit or stash them first — or rerun with `npm run restore -- --force` to discard.\n');
  process.exit(1);
}

console.log(`\n  restoring ${branch} from origin …`);
run(`git fetch origin ${branch}`);
run('git reset --hard FETCH_HEAD');
console.log('\n  installing dependencies …');
run('npm install --no-audit --no-fund');

const head = execSync('git log --oneline -1', { encoding: 'utf8' }).trim();
console.log(`\n  ✔ restored at ${head}`);
console.log('  → start the preview with `npm run dev`\n');
