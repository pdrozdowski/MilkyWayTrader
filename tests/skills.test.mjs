import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve('.');
const runner = join(root, '.agents/skills/cicd-run-tests/scripts/run-tests.mjs');
const validator = join(root, '.agents/skills/cicd-fix-tests/scripts/validate-report.mjs');
const refiner = join(root, '.agents/skills/utils-refine-skill/scripts/audit-skill.mjs');

function command (script, args, cwd = root)
{
    return spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', windowsHide: true });
}

function scripts (overrides = {})
{
    const pass = 'node -e "process.exit(0)"';
    return Object.fromEntries([
        'test:domain', 'test:mechanics', 'test:objects', 'test:audio', 'test:skills', 'test:architecture', 'test:ui', 'typecheck'
    ].map(name => [name, overrides[name] ?? pass]));
}

async function fixture (testScripts)
{
    await mkdir(join(root, '.cache'), { recursive: true });
    const directory = await mkdtemp(join(root, '.cache/runner-fixture-'));
    await writeFile(join(directory, 'package.json'), JSON.stringify({ scripts: testScripts }, null, 2));
    return directory;
}

function reportPath (run, directory)
{
    const relative = run.stdout.match(/^Report (.+)$/m)?.[1];
    assert(relative, run.stdout || run.stderr);
    return join(directory, relative);
}

test('skill refiner reports clean skills and structural failures', async () => {
    const directory = await fixture({});
    const good = join(directory, 'good-skill');
    await mkdir(join(good, 'references'), { recursive: true });
    await writeFile(join(good, 'SKILL.md'), '---\nname: good-skill\ndescription: Perform one focused test workflow for this fixture.\n---\n\nRead [contract](references/contract.md).\n');
    await writeFile(join(good, 'references/contract.md'), '# Contract\n');
    const clean = command(refiner, [good, '--report-dir', join(directory, 'reports')]);
    assert.equal(clean.status, 0, clean.stderr);
    assert.match(clean.stdout, /HIGH 0 MEDIUM 0/);

    const bad = join(directory, 'bad-skill');
    await mkdir(bad);
    await writeFile(join(bad, 'SKILL.md'), '---\nname: wrong-name\ndescription: TODO\n---\n\n[missing](references/no.md)\n');
    const failed = command(refiner, [bad, '--report-dir', join(directory, 'reports')]);
    assert.equal(failed.status, 1);
    assert.match(failed.stdout, /HIGH [1-9]/);
});

test('test runner records all failures, removes ANSI and keeps running', async () => {
    const fail = value => `node -e "console.error('\\u001b[31m${value}\\u001b[0m');process.exit(1)"`;
    const directory = await fixture(scripts({ 'test:mechanics': fail('MECHANICS BROKEN'), 'test:audio': fail('AUDIO BROKEN') }));
    const run = command(runner, ['--root', directory]);
    assert.equal(run.status, 1, run.stderr);
    const report = await readFile(reportPath(run, directory), 'utf8');
    assert.match(report, /Status: \*\*TEST_FAILURE\*\*/);
    assert.match(report, /MECHANICS BROKEN/);
    assert.match(report, /AUDIO BROKEN/);
    assert(!report.includes('\u001b['));
    assert.match(report, /Failure fingerprint: `[a-f0-9]{64}`/);
    assert.match(report, /\| typecheck \|[^\n]+PASS/);
});

test('runner distinguishes environment failures and report validation detects staleness', async () => {
    const missingUi = scripts();
    delete missingUi['test:ui'];
    const environmentDirectory = await fixture(missingUi);
    const environmentRun = command(runner, ['--root', environmentDirectory]);
    assert.equal(environmentRun.status, 2);
    const environmentReport = await readFile(reportPath(environmentRun, environmentDirectory), 'utf8');
    assert.match(environmentReport, /Status: \*\*ENVIRONMENT_FAILURE\*\*/);
    assert.match(environmentReport, /Missing package script: test:ui/);

    const currentDirectory = await fixture(scripts());
    const currentRun = command(runner, ['--root', currentDirectory]);
    assert.equal(currentRun.status, 0, currentRun.stderr);
    const report = reportPath(currentRun, currentDirectory);
    assert.equal(command(validator, [report]).status, 0);
    await writeFile(join(currentDirectory, 'changed.ts'), 'export const changed = true;\n');
    const stale = command(validator, [report]);
    assert.equal(stale.status, 1);
    assert.match(stale.stderr, /STALE_REPORT/);
});
