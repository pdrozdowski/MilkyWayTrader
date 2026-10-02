import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execute = promisify(execFile);

export default async function globalSetup (): Promise<void>
{
    await execute(process.execPath, ['scripts/prepare-test-database.mjs'], {
        cwd: process.cwd(),
        env: process.env
    });
}
