import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function transpile (path, imports) {
    const source = readFileSync(path, 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
    const module = { exports: {} };
    new Function('require', 'module', 'exports', compiled)(name => imports[name], module, module.exports);
    return module.exports;
}

const { displayLabels } = transpile('src/ui/components/displayLabels.ts', {});
const { mountGlobalHighScores } = transpile('src/ui/components/globalHighScores.ts', {
    '../contracts': {},
    '../../game/application/results/globalScoreStore': {},
    '../../game/application/results/resultHistoryStore': {},
    './displayLabels': { displayLabels },
    './formatCredits': { formatCredits: value => String(value) }
});

class Element {
    constructor () { this.textContent = ''; this.hidden = false; this.disabled = false; this.listeners = new Map(); this.children = {}; this.childrenList = []; this.isConnected = true; this.attributes = new Map(); }
    setAttribute (name, value) { this.attributes.set(name, value); }
    addEventListener (name, fn) { this.listeners.set(name, fn); }
    removeEventListener (name) { this.listeners.delete(name); }
    click () { if (!this.disabled) this.listeners.get('click')?.(); }
    focus () { globalThis.document.activeElement = this; }
    append (...elements) { this.childrenList.push(...elements); }
    replaceChildren (...elements) { this.childrenList = elements; }
    querySelector (selector) { return this.children[selector] ?? null; }
    querySelectorAll () { return this.focusControls ?? []; }
}

const ids = ['#global-high-scores', '#global-high-scores-title', '#global-high-scores-nickname', '#global-high-scores-rank', '#global-high-scores-status', '#global-high-scores-retry', '#global-high-scores-table', '#global-high-scores-rows', '#global-high-scores-rank-heading', '#global-high-scores-nickname-heading', '#global-high-scores-date-heading', '#global-high-scores-score-heading', '#global-high-scores-close', '#main-menu-global-scores', '#game-menu-global-scores', '#game-over-global-scores', '#main-menu', '#game-menu'];
const scores = [
    { rank: 1, nickname: 'StarPilot', achievedAt: '2026-10-14T10:00:00Z', score: 1200 },
    { rank: 2, nickname: 'MilkRunner', achievedAt: '2026-10-13T10:00:00Z', score: 1100 },
    { rank: 2, nickname: 'NebulaAce', achievedAt: '2026-10-12T10:00:00Z', score: 1100 }
];

function setup (authStatus = 'signed-in', options = {}) {
    const elements = Object.fromEntries(ids.map(id => [id, new Element()]));
    elements['#global-high-scores'].focusControls = [elements['#global-high-scores-retry'], elements['#global-high-scores-close']];
    const root = new Element(); root.children = elements;
    let snapshot = { status: authStatus, email: authStatus === 'signed-in' ? 'pilot@example.test' : null };
    let listener;
    const auth = { getSnapshot: () => snapshot, subscribe: fn => { listener = fn; return () => {}; } };
    const calls = { top: 0, rank: [], best: 0, profile: 0 };
    const store = options.store ?? {
        getTop: async () => { calls.top++; return { data: options.scores ?? scores, error: null }; },
        getPersonalBestRank: async score => { calls.rank.push(score); return { data: score === 1100 ? 2 : 7, error: null }; },
        submit: async () => ({ error: null })
    };
    const history = options.history ?? { getBest: async () => { calls.best++; return { data: Object.hasOwn(options, 'best') ? options.best : { finalScore: 1100 }, error: null }; } };
    const profilePort = options.profilePort ?? { loadOrCreate: async () => { calls.profile++; return { nickname: 'StarPilot' }; } };
    globalThis.document = { activeElement: null, createElement: () => new Element() };
    const windowListeners = new Map();
    globalThis.window = { addEventListener (name, fn) { windowListeners.set(name, fn); }, removeEventListener (name) { windowListeners.delete(name); } };
    const component = mountGlobalHighScores(root, { auth, store, history, profilePort });
    return { elements, component, calls, authChange: value => { snapshot = value; listener(value); }, keydown: event => windowListeners.get('keydown')?.(event) };
}

test('global board renders ranked public fields and the signed-in private Personal Best rank', async () => {
    const view = setup();
    view.elements['#game-menu-global-scores'].click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(view.elements['#global-high-scores'].hidden, false);
    assert.equal(view.elements['#game-menu'].hidden, true);
    assert.equal(view.elements['#global-high-scores-title'].textContent, displayLabels.globalHighScoresTitle);
    assert.equal(view.elements['#global-high-scores-rank'].textContent, displayLabels.globalHighScoresRankCallout.replace('{rank}', '2'));
    assert.equal(view.elements['#global-high-scores-nickname'].textContent, 'PLAYER: StarPilot');
    assert.deepEqual([
        view.elements['#global-high-scores-rank-heading'].textContent,
        view.elements['#global-high-scores-nickname-heading'].textContent,
        view.elements['#global-high-scores-date-heading'].textContent,
        view.elements['#global-high-scores-score-heading'].textContent
    ], ['#', 'NICKNAME', 'DATE', 'SCORE']);
    assert.deepEqual(view.elements['#global-high-scores-rows'].childrenList.map(row => row.childrenList.map(cell => cell.textContent)), [
        ['1', 'StarPilot', '14 OCT 2026', '1200'],
        ['2', 'MilkRunner', '13 OCT 2026', '1100'],
        ['2', 'NebulaAce', '12 OCT 2026', '1100']
    ]);
    assert.deepEqual(view.calls.rank, [1100]);
    view.elements['#global-high-scores-close'].click();
    assert.equal(view.elements['#game-menu'].hidden, false);
    assert.equal(globalThis.document.activeElement, view.elements['#game-menu-global-scores']);
    view.component.destroy();
});

test('anonymous players can read the public board without a private rank or profile request', async () => {
    const view = setup('unsigned');
    view.elements['#main-menu-global-scores'].click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(view.elements['#main-menu'].hidden, true);
    assert.equal(view.elements['#global-high-scores-table'].hidden, false);
    assert.equal(view.elements['#global-high-scores-rank'].hidden, true);
    assert.equal(view.elements['#global-high-scores-nickname'].hidden, true);
    assert.equal(view.calls.best, 0);
    assert.equal(view.calls.profile, 0);
    view.elements['#global-high-scores-close'].click();
    assert.equal(view.elements['#main-menu'].hidden, false);
    view.component.destroy();
});

test('a signed-in player without a Personal Best has no private rank callout', async () => {
    const view = setup('signed-in', { best: null });
    view.elements['#main-menu-global-scores'].click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(view.elements['#global-high-scores-rank'].hidden, true);
    assert.deepEqual(view.calls.rank, []);
    view.component.destroy();
});

test('private rank failure leaves successfully loaded public board visible', async () => {
    const store = {
        getTop: async () => ({ data: scores, error: null }),
        getPersonalBestRank: async () => ({ data: null, error: 'private rank unavailable' }),
        submit: async () => ({ error: null })
    };
    const view = setup('signed-in', { store });
    view.elements['#main-menu-global-scores'].click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(view.elements['#global-high-scores-table'].hidden, false);
    assert.equal(view.elements['#global-high-scores-rows'].childrenList.length, 3);
    assert.equal(view.elements['#global-high-scores-status'].textContent, '');
    assert.equal(view.elements['#global-high-scores-rank'].hidden, false);
    assert.equal(view.elements['#global-high-scores-rank'].textContent, displayLabels.globalHighScoresRankUnavailable);
    view.component.destroy();
});

test('empty board, errors and retry are rendered; Game Over entry opens the same board', async () => {
    const empty = setup('unsigned', { scores: [] });
    empty.elements['#game-over-global-scores'].click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(empty.elements['#global-high-scores-status'].textContent, displayLabels.globalHighScoresNoScores);
    assert.equal(empty.elements['#global-high-scores-table'].hidden, true);
    empty.component.destroy();

    let fail = true;
    let topCalls = 0;
    const errorStore = {
        getTop: async () => { topCalls++; return fail ? { data: null, error: 'offline' } : { data: scores, error: null }; },
        getPersonalBestRank: async () => ({ data: 1, error: null }),
        submit: async () => ({ error: null })
    };
    const failed = setup('unsigned', { store: errorStore });
    failed.elements['#game-over-global-scores'].click();
    await new Promise(resolve => setImmediate(resolve));
    assert.match(failed.elements['#global-high-scores-status'].textContent, /offline/);
    assert.equal(failed.elements['#global-high-scores-retry'].hidden, false);
    fail = false;
    failed.elements['#global-high-scores-retry'].click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(topCalls, 2);
    assert.equal(failed.elements['#global-high-scores-rows'].childrenList.length, 3);
    failed.component.destroy();
});

test('application UI wires the global adapter and all three menu entry points', () => {
    const setupSource = readFileSync('src/ui/setupUi.ts', 'utf8');
    const componentSource = readFileSync('src/ui/components/globalHighScores.ts', 'utf8');
    const html = readFileSync('index.html', 'utf8');
    assert.match(setupSource, /createBrowserGlobalScoreStore/);
    assert.match(setupSource, /mountGlobalHighScores\(root/);
    assert.match(componentSource, /#main-menu-global-scores/);
    assert.match(componentSource, /#game-menu-global-scores/);
    assert.match(componentSource, /#game-over-global-scores/);
    assert.match(html, /id="main-menu-global-scores"/);
    assert.match(html, /id="game-menu-global-scores"/);
    assert.match(html, /id="game-over-global-scores"/);
});
