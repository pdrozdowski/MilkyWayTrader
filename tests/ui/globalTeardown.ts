import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execute = promisify(execFile);

export default async function globalTeardown (): Promise<void>
{
    await execute(process.execPath, ['scripts/cleanup-test-session.mjs'], {
        cwd: process.cwd(),
        env: process.env
    });
}
