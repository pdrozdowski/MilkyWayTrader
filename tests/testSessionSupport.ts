import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const sessionDirectory = resolve(process.cwd(), '.cache', 'playwright', 'sessions');
const require = createRequire(`${process.cwd()}/package.json`);
const { loadTestSessionRuntime } = require('./scripts/test-session-runtime-loader.cjs') as {
    loadTestSessionRuntime(): Promise<{
        createClient(url: string, key: string, options: unknown): {
            auth: { admin: { deleteUser(userId: string): Promise<{ error: { readonly message: string } | null }> } };
        };
        loadTestEnvironment(): Promise<{ readonly url: string }>;
        localSupabaseStatus(expectedApiUrl: string): { readonly serviceRoleKey: string };
    }>;
};

export type TestSessionMode = 'anonymous' | 'authenticated';

export interface SessionArtifact
{
    readonly id: string;
    readonly testRunId: string;
    readonly mode: TestSessionMode;
    readonly anonymousId: string;
    readonly userId: string | null;
    readonly authStorageKey: string | null;
    readonly authSession: unknown;
}

export interface PublicTestEnvironment
{
    readonly url: string;
    readonly publishableKey: string;
}

export async function createTestSession (
    mode: TestSessionMode,
    testRunId: string,
    recordTiming: (name: string, durationMs: number) => void = () => {}
): Promise<SessionArtifact>
{
    const processStartedAt = performance.now();
    const result = await execute(process.execPath, ['scripts/create-test-session.mjs', mode, testRunId], {
        cwd: process.cwd(),
        env: process.env,
        timeout: 30_000
    });
    recordTiming('Authentication: create user and sign in', performance.now() - processStartedAt);
    const output = JSON.parse(result.stdout) as { sessionFile?: unknown };
    if (typeof output.sessionFile !== 'string' || !/^[0-9a-f-]+\.json$/u.test(output.sessionFile)) throw new Error('Test session setup returned an invalid artifact name.');
    const artifactReadStartedAt = performance.now();
    const artifact = JSON.parse(await readFile(resolve(sessionDirectory, output.sessionFile), 'utf8')) as SessionArtifact;
    recordTiming('Read isolated session artifact', performance.now() - artifactReadStartedAt);
    if (artifact.testRunId !== testRunId || artifact.mode !== mode) throw new Error('Test session setup returned mismatched identity metadata.');
    return artifact;
}

export async function removeTestSessionArtifact (id: string): Promise<void>
{
    try { await unlink(resolve(sessionDirectory, `${id}.json`)); } catch (error) {
        if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ENOENT') throw error;
    }
}

export async function cleanupTestSession (id: string): Promise<void>
{
    const artifactPath = resolve(sessionDirectory, `${id}.json`);
    let artifact: SessionArtifact;
    try { artifact = JSON.parse(await readFile(artifactPath, 'utf8')) as SessionArtifact; }
    catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return;
        throw error;
    }
    const runtime = await loadTestSessionRuntime();
    const environment = await runtime.loadTestEnvironment();
    const { serviceRoleKey } = runtime.localSupabaseStatus(environment.url);
    if (artifact.userId) {
        const admin = runtime.createClient(environment.url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
        const { error } = await admin.auth.admin.deleteUser(artifact.userId);
        if (error && error.message !== 'User not found') throw new Error(`Unable to remove local test user: ${error.message}`);
    }
    await unlink(artifactPath);
}

export async function seedGlobalScore (sessionId: string, score: number): Promise<string>
{
    const result = await execute(process.execPath, ['scripts/seed-test-global-score.mjs', sessionId, String(score)], {
        cwd: process.cwd(),
        env: process.env,
        timeout: 30_000
    });
    const output = JSON.parse(result.stdout) as { nickname?: unknown };
    if (typeof output.nickname !== 'string') throw new Error('Local global-score setup returned an invalid nickname.');
    return output.nickname;
}

export async function loadPublicTestEnvironment (): Promise<PublicTestEnvironment>
{
    const source = await readFile(resolve(process.cwd(), '.env.test'), 'utf8');
    const values = new Map<string, string>();
    for (const rawLine of source.split(/\r?\n/u)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u.exec(line);
        if (!match) throw new Error(`Invalid .env.test entry: ${rawLine}`);
        const name = match[1];
        const rawValue = match[2].trim();
        values.set(name, (rawValue.startsWith('"') && rawValue.endsWith('"')) || (rawValue.startsWith("'") && rawValue.endsWith("'"))
            ? rawValue.slice(1, -1)
            : rawValue);
    }
    const url = values.get('VITE_SUPABASE_URL');
    const publishableKey = values.get('VITE_SUPABASE_PUBLISHABLE_KEY');
    if (!url || !publishableKey) throw new Error('.env.test must define VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'http:' || !['localhost', '127.0.0.1', '::1'].includes(parsedUrl.hostname)) throw new Error('.env.test must target local Supabase.');
    return Object.freeze({ url, publishableKey });
}
