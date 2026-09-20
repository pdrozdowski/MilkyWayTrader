#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import process from 'node:process';
import { normalizedFailure, stripAnsi, workspaceFingerprint } from './report-utils.mjs';

const suites = [
    ['domain', 'test:domain'],
    ['mechanics', 'test:mechanics'],
    ['objects', 'test:objects'],
    ['audio', 'test:audio'],
    ['skills', 'test:skills'],
    ['architecture', 'test:architecture'],
    ['ui', 'test:ui'],
    ['typecheck', 'typecheck']
];

function usage (message)
{
    if (message) console.error(message);
    console.error('Usage: run-tests.mjs [--root <project>] [--report-dir <directory>]');
    process.exit(message ? 2 : 0);
}

const args = process.argv.slice(2);
if (args.includes('--help')) usage();
let root = resolve('.');
let reportDir;
while (args.length) {
    const flag = args.shift();
    if (flag === '--root' && args.length) root = resolve(args.shift());
    else if (flag === '--report-dir' && args.length) reportDir = args.shift();
    else usage(`Unknown or incomplete option: ${flag}`);
}

let manifest;
try { manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')); }
catch { usage(`Cannot read package.json in ${root}`); }
const stamp = new Date().toISOString().replaceAll(':', '-');
const runId = `${stamp}-${process.pid}`;
let base = reportDir ?? join(root, '.cache/test-runs');
if (!isAbsolute(base)) base = resolve(root, base);
const directory = join(base, runId);
await mkdir(directory, { recursive: true });

const bundledNpm = join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
const npmCli = process.env.npm_execpath ?? (existsSync(bundledNpm) ? bundledNpm : null);
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const results = [];
for (const [name, script] of suites) {
    const started = performance.now();
    let result;
    if (!manifest.scripts?.[script]) {
        result = { status: 2, stdout: '', stderr: `Missing package script: ${script}`, error: null };
    } else {
        const child = spawnSync(npmCli ? process.execPath : npmCommand, npmCli ? [npmCli, 'run', script] : ['run', script], {
            cwd: root,
            env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
            encoding: 'utf8', windowsHide: true, maxBuffer: 50 * 1024 * 1024
        });
        result = { status: child.status, stdout: child.stdout ?? '', stderr: child.stderr ?? '', error: child.error };
    }
    const output = stripAnsi(`${result.stdout}${result.stderr ? `\n${result.stderr}` : ''}`);
    const log = join(directory, `${name}.log`);
    await writeFile(log, output);
    const environment = result.status === 2 || Boolean(result.error)
        || /Executable doesn't exist|playwright install|Missing package script|ENOENT|not recognized as an internal or external command/i.test(output);
    results.push({
        name, script, output, log,
        duration: Math.round(performance.now() - started),
        exitCode: result.status ?? 2,
        status: result.status === 0 ? 'PASS' : environment ? 'ENVIRONMENT_FAILURE' : 'TEST_FAILURE'
    });
}

const failures = results.filter(result => result.status !== 'PASS');
const overall = failures.some(result => result.status === 'ENVIRONMENT_FAILURE')
    ? 'ENVIRONMENT_FAILURE'
    : failures.length ? 'TEST_FAILURE' : 'PASS';
const normalized = failures.map(result => `${result.name}\n${normalizedFailure(result.output, root)}`).join('\n---\n');
const failureFingerprint = failures.length ? createHash('sha256').update(normalized).digest('hex') : 'none';
const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).stdout?.trim() || 'unavailable';
const dirty = spawnSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8', windowsHide: true }).stdout?.trim();
const sourceFingerprint = await workspaceFingerprint(root);
const artifactCandidates = ['.cache/playwright/report/index.html', '.cache/playwright/test-results'];
const artifacts = [];
for (const artifact of artifactCandidates) {
    try { await access(join(root, artifact)); artifacts.push(artifact); } catch { /* Optional failure evidence. */ }
}
const excerpt = output => {
    const lines = normalizedFailure(output, root).split(/\r?\n/);
    return lines.slice(Math.max(0, lines.length - 80)).join('\n').slice(-12_000);
};
const report = join(directory, 'results.md');
const reportText = [
    '# Project test results', '',
    `- Status: **${overall}**`,
    `- UTC: ${new Date().toISOString()}`,
    `- Workspace: \`${root}\``,
    `- Revision: \`${revision}\``,
    `- Dirty: ${dirty ? 'yes' : 'no'}`,
    `- Node/platform: \`${process.version} ${process.platform} ${process.arch}\``,
    `- Workspace fingerprint: \`${sourceFingerprint}\``,
    `- Failure fingerprint: \`${failureFingerprint}\``, '',
    '| Suite | Command | Status | Exit | Duration | Raw log |',
    '| --- | --- | --- | ---: | ---: | --- |',
    ...results.map(result => `| ${result.name} | \`npm run ${result.script}\` | ${result.status} | ${result.exitCode} | ${result.duration} ms | \`${relative(root, result.log)}\` |`),
    '', '## Failures', '',
    ...(failures.length ? failures.flatMap(result => [
        `### ${result.name}`, '',
        `Reproduce: \`npm run ${result.script}\``, '',
        '```text', excerpt(result.output), '```', ''
    ]) : ['- None.', '']),
    '## Browser artifacts', '',
    ...(artifacts.length ? artifacts.map(item => `- \`${item}\``) : ['- None generated.']), '',
    overall === 'ENVIRONMENT_FAILURE'
        ? 'Resolve the runner/dependency problem shown above. For a missing browser run `npm run test:ui:install`.'
        : overall === 'TEST_FAILURE'
            ? `Next: use \`$cicd-fix-tests ${relative(root, report)}\`, then rerun all tests.`
            : 'All unit, architecture, UI and typecheck suites passed.', ''
].join('\n');
await writeFile(report, reportText);
console.log(`${overall}\nReport ${relative(root, report)}\nFailure fingerprint ${failureFingerprint}`);
process.exit(overall === 'PASS' ? 0 : overall === 'TEST_FAILURE' ? 1 : 2);

