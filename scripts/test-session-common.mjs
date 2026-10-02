import { execFileSync } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '..');
const testEnvironmentPath = resolve(repositoryRoot, '.env.test');
export const sessionDirectory = resolve(repositoryRoot, '.cache', 'playwright', 'sessions');

export async function loadTestEnvironment ()
{
    const source = await readFile(testEnvironmentPath, 'utf8');
    const values = Object.create(null);
    for (const rawLine of source.split(/\r?\n/u)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u.exec(line);
        if (!match) throw new Error(`Invalid .env.test entry: ${rawLine}`);
        const [, name, rawValue] = match;
        values[name] = unwrap(rawValue.trim());
    }
    const url = required(values, 'VITE_SUPABASE_URL');
    const publishableKey = required(values, 'VITE_SUPABASE_PUBLISHABLE_KEY');
    const testUserEmail = required(values, 'TEST_USER_EMAIL');
    const testUserPassword = required(values, 'TEST_USER_PASSWORD');
    assertLocalSupabaseUrl(url);
    return Object.freeze({ url, publishableKey, testUserEmail, testUserPassword });
}

export function assertLocalSupabaseUrl (value)
{
    let parsed;
    try { parsed = new URL(value); } catch { throw new Error('.env.test VITE_SUPABASE_URL must be a valid URL.'); }
    if (parsed.protocol !== 'http:' || !['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) {
        throw new Error('.env.test must target a local HTTP Supabase instance; refusing to use a remote project.');
    }
}

export function localSupabaseStatus ()
{
    let output;
    try {
        output = executeSupabase(['status', '--output', 'json'], {
            cwd: repositoryRoot,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe']
        });
    } catch {
        throw new Error('Local Supabase is not available. Start the Docker stack with `npx supabase start` and retry.');
    }
    const jsonStart = output.indexOf('{');
    if (jsonStart < 0) throw new Error('Local Supabase returned an unreadable status response.');
    const values = JSON.parse(output.slice(jsonStart));
    return Object.freeze({ serviceRoleKey: required(values, 'SERVICE_ROLE_KEY') });
}

export async function ensureSessionDirectory ()
{
    await mkdir(sessionDirectory, { recursive: true });
}

export function runSupabase (argumentsList)
{
    try {
        executeSupabase(argumentsList, {
            cwd: repositoryRoot,
            stdio: 'inherit'
        });
    } catch {
        throw new Error(`Supabase command failed: supabase ${argumentsList.join(' ')}`);
    }
}

function executeSupabase (argumentsList, options)
{
    if (process.platform !== 'win32') return execFileSync('npx', ['--no-install', 'supabase', ...argumentsList], options);
    return execFileSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', ['npx.cmd', '--no-install', 'supabase', ...argumentsList].join(' ')], options);
}

function required (values, name)
{
    if (!values[name]) throw new Error(`.env.test must define ${name}.`);
    return values[name];
}

function unwrap (value)
{
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) return value.slice(1, -1);
    return value;
}
