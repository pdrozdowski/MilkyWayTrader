import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execute = promisify(execFile);

export default async function globalTeardown (): Promise<void>
{
    const startedAt = performance.now();
    try {
        await execute(process.execPath, ['scripts/cleanup-test-session.mjs'], {
            cwd: process.cwd(),
            env: process.env,
            timeout: 30_000
        });
    } finally {
        console.log(`GLOBAL_TEARDOWN_TIMINGS ${JSON.stringify([{ name: 'Sweep test sessions', durationMs: performance.now() - startedAt }])}`);
    }
}
