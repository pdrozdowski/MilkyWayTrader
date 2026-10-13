#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseEnv } from 'node:util';

const args = process.argv.slice(2);
if (args.includes('--help')) {
    console.log('Usage: node deploy.mjs --target test [--dry-run]');
    process.exit(0);
}

const dryRun = args.includes('--dry-run');
const targetIndex = args.indexOf('--target');
if (targetIndex < 0 || args[targetIndex + 1] !== 'test' || args.some((arg, index) => !['--dry-run', '--target', 'test'].includes(arg) || (arg === 'test' && index !== targetIndex + 1))) {
    console.error('Refusing deployment. Usage: node deploy.mjs --target test [--dry-run]');
    process.exit(2);
}

const root = resolve('.');
const envPath = join(root, '.env.local');
const linkedPath = join(root, 'supabase', '.temp', 'linked-project.json');

function stop (message)
{
    console.error(message);
    process.exit(1);
}

let env;
let linked;
try {
    env = parseEnv(await readFile(envPath, 'utf8'));
    linked = JSON.parse(await readFile(linkedPath, 'utf8'));
} catch {
    stop('Missing or invalid .env.local or Supabase CLI link metadata. Configure and link the test project first.');
}

let projectUrl;
try { projectUrl = new URL(env.VITE_SUPABASE_URL ?? ''); }
catch { stop('VITE_SUPABASE_URL in .env.local must be a valid HTTPS Supabase project URL.'); }

const hostMatch = projectUrl.hostname.match(/^([a-z0-9]+)\.supabase\.co$/i);
if (projectUrl.protocol !== 'https:' || !hostMatch) stop('Only a remote Supabase project URL is allowed; local and unrecognized targets are refused.');
const projectRef = hostMatch[1];
if (linked.ref !== projectRef) stop('The linked Supabase project does not match VITE_SUPABASE_URL in .env.local.');
if (/(^|[-_ ])prod(uction)?($|[-_ ])/i.test(String(linked.name ?? ''))) stop('The linked project name looks production; refusing deployment.');

for (const file of ['.env.prod', '.env.production']) {
    if (!existsSync(join(root, file))) continue;
    try {
        const candidate = parseEnv(await readFile(join(root, file), 'utf8'));
        if (candidate.VITE_SUPABASE_URL && new URL(candidate.VITE_SUPABASE_URL).hostname === projectUrl.hostname) {
            stop('The configured target also appears in ' + file + '; refusing deployment.');
        }
    } catch (error) {
        if (error instanceof Error && error.message.startsWith('The configured target')) throw error;
    }
}

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
function runSupabase (cliArgs)
{
    const result = spawnSync(command, ['--no-install', 'supabase', ...cliArgs], {
        cwd: root, stdio: 'inherit', windowsHide: true, shell: process.platform === 'win32'
    });
    if (result.error) stop('Could not start Supabase CLI: ' + result.error.message);
    if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log('Linking the configured Supabase test project.');
runSupabase(['link', '--project-ref', projectRef]);
console.log((dryRun ? 'Previewing' : 'Deploying') + ' pending migrations to the configured Supabase test project.');
const pushArgs = ['db', 'push', '--linked', '--include-all', '--yes'];
if (dryRun) pushArgs.push('--dry-run');
runSupabase(pushArgs);
console.log(dryRun ? 'Supabase migration preview complete.' : 'Supabase migrations applied successfully.');
