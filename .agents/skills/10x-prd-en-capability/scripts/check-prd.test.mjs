import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const checker = resolve('.agents/skills/10x-prd-en-capability/scripts/check-prd.mjs');

async function check(body)
{
    const directory = await mkdtemp(join(tmpdir(), 'prd-capability-'));
    const file = join(directory, 'prd.md');
    await writeFile(file, body);
    return spawnSync(process.execPath, [checker, file], { encoding: 'utf8', windowsHide: true });
}

const valid = `# Product

## Functional Requirements

### Session

- FR-001: A player can start a new game. Priority: must-have
- FR-002: The game can preserve signed-in progress. Priority: must-have

## Non-Functional Requirements

- Responses remain timely.
`;

test('accepts sequential English capability requirements', async () => {
    const result = await check(valid);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /PASS/);
});

test('rejects Polish prose and non-sequential requirements', async () => {
    const result = await check(valid.replace('# Product', '# Gra').replace('FR-002', 'FR-003'));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /NON_ENGLISH/);
    assert.match(result.stderr, /FR_SEQUENCE/);
});

test('rejects malformed requirements', async () => {
    const source = valid.replace('A player can start a new game. Priority: must-have', 'A player starts a new game');
    const result = await check(source);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /line \d+ \[FR_FORMAT\]/);
});

test('rejects composite capabilities', async () => {
    const source = valid.replace('start a new game', 'start a new game and then publish a score');
    const result = await check(source);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /FR_COMPOSITE/);
});

test('rejects solution-oriented requirements', async () => {
    const source = valid.replace('A player can start a new game', 'A button can open a game screen');
    const result = await check(source);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /FR_SOLUTION/);
});

test('rejects duplicated requirement identifiers', async () => {
    const source = valid.replace('FR-002', 'FR-001');
    const result = await check(source);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /FR_DUPLICATE/);
});

test('rejects explanatory content inside the FR section', async () => {
    const source = valid.replace('### Session\n', '### Session\n\n+This paragraph does not belong here.\n');
    const result = await check(source);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /FR_SECTION_CONTENT/);
});
