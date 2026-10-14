import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBrowserResultHistoryStore } from '../../src/ui/adapters/browserResultHistoryStore.ts';

const configuration = { url: 'http://localhost:54321', publishableKey: 'public-test-key-that-is-long-enough' };
const rows = Array.from({ length: 12 }, (_, index) => ({
    run_id: `run-${index}`,
    active_elapsed_ms: 12_345 + index,
    final_credits: 1000 - index,
    final_score: 2000 - index,
    outcome: 'death',
    created_at: `2026-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`
}));

function clientFor ({ result = { data: rows, count: rows.length, error: null }, thrown = null } = {})
{
    const operations = [];
    const query = {
        then (resolve, reject) { return Promise.resolve().then(() => { if (thrown) throw thrown; return result; }).then(resolve, reject); },
        select (columns, options) { operations.push(['select', columns, options]); return query; },
        order (column, options) { operations.push(['order', column, options]); return query; },
        range (from, to) { operations.push(['range', from, to]); return query; },
        limit (count) { operations.push(['limit', count]); return query; },
        not (column, operator, value) { operations.push(['not', column, operator, value]); return query; }
    };
    return { operations, client: { from: table => { assert.equal(table, 'run_results'); return query; } } };
}

test('history page maps rows, requests exact count and the requested five-row range in order', async () => {
    const fixture = clientFor({ result: { data: rows.slice(5, 10), count: 12, error: null } });
    const store = createBrowserResultHistoryStore(configuration, () => fixture.client);

    assert.deepEqual(await store.getPage(1), {
        data: { records: rows.slice(5, 10).map(row => ({ runId: row.run_id, activeElapsedMs: row.active_elapsed_ms, finalCredits: row.final_credits, finalScore: row.final_score, outcome: row.outcome, savedAt: row.created_at })), totalCount: 12 },
        error: null
    });
    assert.deepEqual(fixture.operations, [
        ['select', 'run_id, active_elapsed_ms, final_credits, final_score, outcome, created_at', { count: 'exact' }],
        ['order', 'final_credits', { ascending: false }],
        ['order', 'created_at', { ascending: false }],
        ['order', 'run_id', { ascending: true }],
        ['range', 5, 9]
    ]);
});

test('history page zero and final partial page use five-row inclusive boundaries', async () => {
    const fixture = clientFor({ result: { data: rows.slice(10), count: 12, error: null } });
    const store = createBrowserResultHistoryStore(configuration, () => fixture.client);

    await store.getPage(0);
    assert.deepEqual(fixture.operations.filter(operation => operation[0] === 'range'), [['range', 0, 4]]);
    fixture.operations.length = 0;
    await store.getPage(2);
    assert.deepEqual(fixture.operations.filter(operation => operation[0] === 'range'), [['range', 10, 14]]);
});

test('best record resolves ties by earliest timestamp then run id and limits the query to one', async () => {
    const tied = [
        { run_id: 'b', active_elapsed_ms: 61_000, final_credits: 900, final_score: 1200, outcome: 'death', created_at: '2026-01-01T00:00:00Z' },
        { run_id: 'a', active_elapsed_ms: 62_000, final_credits: 900, final_score: 1200, outcome: 'death', created_at: '2026-01-01T00:00:00Z' }
    ];
    const fixture = clientFor({ result: { data: [tied[1]], count: 2, error: null } });
    const best = await createBrowserResultHistoryStore(configuration, () => fixture.client).getBest();

    assert.deepEqual(best, { data: { runId: 'a', activeElapsedMs: 62_000, finalCredits: 900, finalScore: 1200, outcome: 'death', savedAt: '2026-01-01T00:00:00Z' }, error: null });
    assert.deepEqual(fixture.operations, [
        ['select', 'run_id, active_elapsed_ms, final_credits, final_score, outcome, created_at', { count: 'exact' }],
        ['not', 'final_score', 'is', null],
        ['order', 'final_score', { ascending: false }],
        ['order', 'created_at', { ascending: true }],
        ['order', 'run_id', { ascending: true }],
        ['limit', 1]
    ]);
});

test('history reads return database and thrown failures and reject invalid pages', async () => {
    const store = createBrowserResultHistoryStore(configuration, () => clientFor({ result: { data: null, count: null, error: { message: 'Read denied' } } }).client);
    assert.deepEqual(await store.getPage(0), { data: null, error: 'Read denied' });
    assert.deepEqual(await store.getPage(-1), { data: null, error: 'Invalid result history page.' });

    const thrown = createBrowserResultHistoryStore(configuration, () => clientFor({ thrown: new Error('Connection lost') }).client);
    assert.deepEqual(await thrown.getBest(), { data: null, error: 'Connection lost' });
});
