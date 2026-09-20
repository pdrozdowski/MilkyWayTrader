import { spawnSync } from 'node:child_process';

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('npm_execpath is unavailable; run this check through npm.');

const result = spawnSync(process.execPath, [
    '--use-system-ca', npmCli, 'audit', '--audit-level=high'
], { stdio: 'inherit', windowsHide: true });

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
