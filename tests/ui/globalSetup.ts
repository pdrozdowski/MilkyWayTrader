import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const require = createRequire(`${process.cwd()}/package.json`);
const { loadTestSessionRuntime } = require('./scripts/test-session-runtime-loader.cjs') as {
    loadTestSessionRuntime(): Promise<{
        loadTestEnvironment(): Promise<{ readonly url: string }>;
        localSupabaseStatus(expectedApiUrl: string): { readonly serviceRoleKey: string; readonly apiUrl: string };
    }>;
};

export default async function globalSetup (): Promise<void>
{
    const timings: { name: string; durationMs: number }[] = [];
    let startedAt = performance.now();
    const databaseSetup = await execute(process.execPath, ['scripts/prepare-test-database.mjs'], {
        cwd: process.cwd(),
        env: process.env,
        timeout: 210_000
    });
    const resetCount = databaseSetup.stdout.split('PLAYWRIGHT_SUITE_DB_RESET').length - 1;
    if (resetCount !== 1) throw new Error(`Expected exactly one suite database reset, observed ${resetCount}.`);
    console.log(`PLAYWRIGHT_SUITE_DB_RESET_COUNT ${resetCount}`);
    timings.push({ name: 'Start or reuse Supabase and reset/migrate once', durationMs: performance.now() - startedAt });

    const runtime = await loadTestSessionRuntime();
    const environment = await runtime.loadTestEnvironment();
    const localStatus = runtime.localSupabaseStatus(environment.url);
    process.env.MWT_PLAYWRIGHT_LOCAL_SERVICE_ROLE_KEY = localStatus.serviceRoleKey;
    process.env.MWT_PLAYWRIGHT_LOCAL_API_URL = localStatus.apiUrl;

    startedAt = performance.now();
    await execute(process.execPath, ['scripts/cleanup-test-session.mjs'], {
        cwd: process.cwd(),
        env: process.env,
        timeout: 30_000
    });
    timings.push({ name: 'Sweep stale local sessions', durationMs: performance.now() - startedAt });

    console.log(`GLOBAL_SETUP_TIMINGS ${JSON.stringify(timings)}`);
}
