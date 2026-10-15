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
const contracts = { resultHistoryPageSize: 5 };
const { mountPersonalBest } = transpile('src/ui/components/personalBest.ts', {
    '../contracts': contracts, './displayLabels': { displayLabels }, './formatCredits': { formatCredits: value => String(value) }
});

class Element {
    constructor () { this.textContent = ''; this.hidden = false; this.disabled = false; this.listeners = new Map(); this.children = {}; this.isConnected = true; this.attributes = {}; this.classList = { toggle () {} }; }
    addEventListener (name, fn) { this.listeners.set(name, fn); }
    removeEventListener (name) { this.listeners.delete(name); }
    click () { if (!this.disabled) this.listeners.get('click')?.(); }
    focus () { globalThis.document.activeElement = this; }
    append (...elements) { this.childrenList ??= []; this.childrenList.push(...elements); }
    replaceChildren (...elements) { this.childrenList = elements; }
    querySelector (selector) { return this.children[selector] ?? null; }
    querySelectorAll (selector = '') {
        if (selector === 'button' && this.childrenList) return this.childrenList.flatMap(row => row.childrenList?.[5]?.childrenList ?? []);
        return (this.focusControls ?? Object.values(this.children)).filter(element => !element.hidden && !element.disabled);
    }
    setAttribute (name, value) { this.attributes[name] = value; }
}

const ids = ['#personal-best', '#personal-best-title', '#personal-best-high-score', '#personal-best-status', '#personal-best-sign-in', '#personal-best-retry', '#personal-best-clear-history', '#personal-best-confirmation', '#personal-best-confirmation-title', '#personal-best-confirmation-message', '#personal-best-confirmation-error', '#personal-best-confirmation-no', '#personal-best-confirmation-yes', '#personal-best-table', '#personal-best-rows', '#personal-best-date-heading', '#personal-best-elapsed-heading', '#personal-best-score-heading', '#personal-best-outcome-heading', '#personal-best-best-heading', '#personal-best-delete-heading', '#personal-best-previous', '#personal-best-next', '#personal-best-page-indicator', '#personal-best-close', '#game-menu-personal-best', '#game-over-personal-best', '#game-menu'];
function setup (status = 'signed-in', pages = [], options = {}) {
    const elements = Object.fromEntries(ids.map(id => [id, new Element()]));
    elements['#personal-best'].focusControls = [elements['#personal-best-sign-in'], elements['#personal-best-retry'], elements['#personal-best-clear-history'], elements['#personal-best-previous'], elements['#personal-best-next'], elements['#personal-best-close']];
    const root = new Element(); root.children = elements;
    let snapshot = { status, email: status === 'signed-in' ? 'pilot@example.test' : null };
    let listener;
    const auth = { getSnapshot: () => snapshot, subscribe: fn => { listener = fn; return () => {}; } };
    let calls = 0;
    const store = options.store ?? { getPage: async page => { calls++; return { data: { records: pages.slice(page * 5, page * 5 + 5), totalCount: pages.length }, error: null }; }, getBest: async () => ({ data: options.best ?? pages[0] ?? null, error: null }), deleteResult: async () => ({ success: true, error: null }), clearHistory: async () => ({ success: true, error: null }) };
    const opened = [];
    const windowListeners = new Map();
    globalThis.document = { activeElement: null, createElement: () => new Element() };
    globalThis.window = { addEventListener (name, fn) { windowListeners.set(name, fn); }, removeEventListener (name) { windowListeners.delete(name); } };
    const component = mountPersonalBest(root, { auth, store, openAccount: (...args) => opened.push(args) });
    return { elements, component, authChange: value => { snapshot = value; listener(value); }, opened, calls: () => calls, keydown: event => windowListeners.get('keydown')?.(event), root };
}

function recordRows (view) {
    return view.elements['#personal-best-rows'].childrenList.filter(row => row.attributes.class !== 'personal-best-empty-row');
}

const records = Array.from({ length: 11 }, (_, index) => ({ runId: `run-${index}`, activeElapsedMs: (index + 1) * 61_000, finalCredits: 100 - index, finalScore: 200 - index, outcome: ['freedom', 'imprisonment', 'death', 'abandoned'][index % 4], savedAt: `2026-10-${String(index + 1).padStart(2, '0')}T12:00:00Z` }));
records[0] = { ...records[0], runId: 'tie-z', finalCredits: 1000, finalScore: 1500, savedAt: '2026-10-01T12:00:00Z' };
records[10] = { ...records[10], runId: 'tie-a', finalCredits: 1000, finalScore: 1500, savedAt: '2026-10-01T12:00:00Z' };

test('signed-out prompt reuses account flow, populated rows mark one best and rows can be selected for deletion', async () => {
    // The read port has already resolved the equal score/timestamp tie to the smaller runId;
    // its winning record is deliberately outside the first history page.
    const view = setup('unsigned', records, { best: records[10] });
    view.elements['#game-menu-personal-best'].click();
    assert.equal(view.elements['#personal-best-status'].textContent, displayLabels.personalBestSignInPrompt);
    view.elements['#personal-best-sign-in'].click();
    assert.equal(view.opened[0][0], 'game-menu');
    assert.equal(view.opened[0][1], view.elements['#personal-best-sign-in']);
    view.authChange({ status: 'signed-in', email: 'pilot@example.test' });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(view.elements['#personal-best-rows'].childrenList.length, 5);
    assert.equal(view.elements['#personal-best-rows'].childrenList[0].childrenList[2].textContent, '1500');
    const bestMarkers = view.elements['#personal-best-rows'].childrenList.map(row => row.childrenList[4].textContent).filter(Boolean);
    assert.deepEqual(bestMarkers, []);
    assert.equal(view.elements['#personal-best-rows'].childrenList[0].childrenList[1].textContent, '1m 01s');
    assert.deepEqual(view.elements['#personal-best-rows'].childrenList.map(row => row.childrenList[3].textContent), [displayLabels.personalBestFreedom, displayLabels.personalBestPrison, displayLabels.personalBestDeath, displayLabels.personalBestAbandoned, displayLabels.personalBestFreedom]);
    assert.equal(view.elements['#personal-best-rows'].childrenList[0].childrenList[5].childrenList[0].disabled, false);
    const deleteButton = view.elements['#personal-best-rows'].childrenList[0].childrenList[5].childrenList[0];
    deleteButton.click();
    assert.equal(view.elements['#personal-best-confirmation'].hidden, false);
    assert.match(view.elements['#personal-best-confirmation-message'].textContent, /1500 points/);
    view.elements['#personal-best-confirmation-no'].click();
    assert.equal(view.elements['#personal-best-confirmation'].hidden, true);
    assert.equal(globalThis.document.activeElement, view.elements['#personal-best-rows'].childrenList[0].childrenList[5].childrenList[0]);
    assert.equal(view.elements['#personal-best-rows'].childrenList[0].childrenList[0].textContent, '01 OCT 2026');
    view.elements['#personal-best-next'].click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(view.elements['#personal-best-rows'].childrenList.length, 5);
    view.elements['#personal-best-next'].click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(view.elements['#personal-best-page-indicator'].textContent, '3 / 3');
    assert.equal(view.elements['#personal-best-rows'].childrenList.length, 5);
    assert.equal(recordRows(view).length, 1);
    assert.equal(view.elements['#personal-best-next'].disabled, true);
    const requestsAtLastPage = view.calls();
    view.elements['#personal-best-next'].click();
    assert.equal(view.elements['#personal-best-page-indicator'].textContent, '3 / 3');
    assert.equal(view.calls(), requestsAtLastPage);
    assert.deepEqual(view.elements['#personal-best-rows'].childrenList.map(row => row.childrenList[4].textContent).filter(Boolean), [displayLabels.personalBestBest]);
    view.elements['#personal-best-previous'].click();
    await new Promise(resolve => setImmediate(resolve));
    view.elements['#personal-best-previous'].click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(view.elements['#personal-best-previous'].disabled, true);
    view.elements['#personal-best-previous'].click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(view.elements['#personal-best-page-indicator'].textContent, '1 / 3');
    view.elements['#personal-best-close'].click();
    assert.equal(view.elements['#game-menu'].hidden, false);
    assert.equal(globalThis.document.activeElement, view.elements['#game-menu-personal-best']);
    view.component.destroy();
});

test('empty and error views offer the expected states and retry', async () => {
    const empty = setup('signed-in', []);
    empty.elements['#game-menu-personal-best'].click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(empty.elements['#personal-best-status'].textContent, displayLabels.personalBestNoScores);
    assert.equal(empty.elements['#personal-best-previous'].disabled, true);
    empty.component.destroy();

    let shouldFail = true;
    let retries = 0;
    const store = { getPage: async () => { retries++; return shouldFail ? { data: null, error: 'offline' } : { data: { records: [records[0]], totalCount: 1 }, error: null }; }, getBest: async () => ({ data: shouldFail ? null : records[0], error: null }) };
    const failed = setup('signed-in', [], { store });
    failed.elements['#game-menu-personal-best'].click();
    await new Promise(resolve => setImmediate(resolve));
    assert.match(failed.elements['#personal-best-status'].textContent, /offline/);
    assert.equal(failed.elements['#personal-best-retry'].hidden, false);
    shouldFail = false;
    failed.elements['#personal-best-retry'].click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(retries, 2);
    assert.equal(failed.elements['#personal-best-rows'].childrenList.length, 5);
    assert.equal(recordRows(failed).length, 1);
    assert.equal(failed.elements['#personal-best-status'].textContent, '');
    failed.component.destroy();
});

test('Game Over entry returns focus and sign-out clears rows and closes the dialog', async () => {
    const view = setup('signed-in', records);
    view.elements['#game-over-personal-best'].click();
    await new Promise(resolve => setImmediate(resolve));
    view.elements['#personal-best-close'].click();
    assert.equal(globalThis.document.activeElement, view.elements['#game-over-personal-best']);
    view.elements['#game-over-personal-best'].click();
    await new Promise(resolve => setImmediate(resolve));
    view.authChange({ status: 'unsigned', email: null });
    assert.equal(view.elements['#personal-best'].hidden, true);
    assert.equal(view.elements['#personal-best-table'].hidden, true);
    assert.equal(recordRows(view).length, 0);
    view.component.destroy();
});

test('loading state, both keyboard focus boundaries, Escape, and close are handled', async () => {
    let finishPage;
    const store = {
        getPage: () => new Promise(resolve => { finishPage = resolve; }),
        getBest: async () => ({ data: records[0], error: null })
    };
    const view = setup('signed-in', [], { store });
    view.elements['#game-menu-personal-best'].click();
    assert.equal(view.elements['#personal-best-status'].textContent, displayLabels.personalBestLoading);
    finishPage({ data: { records, totalCount: records.length }, error: null });
    await new Promise(resolve => setImmediate(resolve));

    const first = view.elements['#personal-best-clear-history'];
    const last = view.elements['#personal-best-close'];
    first.focus();
    let prevented = false;
    view.keydown({ key: 'Tab', shiftKey: true, preventDefault: () => { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(globalThis.document.activeElement, last);
    last.focus(); prevented = false;
    view.keydown({ key: 'Tab', shiftKey: false, preventDefault: () => { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(globalThis.document.activeElement, first);

    let escapePrevented = false;
    view.keydown({ key: 'Escape', preventDefault: () => { escapePrevented = true; } });
    assert.equal(escapePrevented, true);
    assert.equal(view.elements['#personal-best'].hidden, true);
    assert.equal(globalThis.document.activeElement, view.elements['#game-menu-personal-best']);
    view.component.destroy();
});

test('confirmed deletion of the current best refreshes history and personal best', async () => {
    let history = records.slice(0, 6);
    const store = {
        getPage: async page => ({ data: { records: history.slice(page * 5, page * 5 + 5), totalCount: history.length }, error: null }),
        getBest: async () => ({ data: history.reduce((best, record) => !best || (record.finalScore ?? record.finalCredits) > (best.finalScore ?? best.finalCredits) ? record : best, null), error: null }),
        deleteResult: async runId => { history = history.filter(record => record.runId !== runId); return { success: true, error: null }; },
        clearHistory: async () => { history = []; return { success: true, error: null }; }
    };
    const view = setup('signed-in', [], { store });
    view.elements['#game-menu-personal-best'].click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(view.elements['#personal-best-high-score'].textContent, '1500');
    view.elements['#personal-best-rows'].childrenList[0].childrenList[5].childrenList[0].click();
    view.elements['#personal-best-confirmation-yes'].click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(history.length, 5);
    assert.equal(view.elements['#personal-best-rows'].childrenList.length, 5);
    assert.equal(view.elements['#personal-best-high-score'].textContent, '199');
    assert.equal(view.elements['#personal-best-confirmation'].hidden, true);

    view.component.destroy();
});

test('deleting the only result on the final page selects the nearest remaining page', async () => {
    let history = records.slice(0, 6);
    const store = {
        getPage: async page => ({ data: { records: history.slice(page * 5, page * 5 + 5), totalCount: history.length }, error: null }),
        getBest: async () => ({ data: history[0] ?? null, error: null }),
        deleteResult: async runId => { history = history.filter(record => record.runId !== runId); return { success: true, error: null }; },
        clearHistory: async () => ({ success: true, error: null })
    };
    const view = setup('signed-in', [], { store });
    view.elements['#game-menu-personal-best'].click();
    await new Promise(resolve => setImmediate(resolve));
    view.elements['#personal-best-next'].click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(view.elements['#personal-best-page-indicator'].textContent, '2 / 2');
    view.elements['#personal-best-rows'].childrenList[0].childrenList[5].childrenList[0].click();
    view.elements['#personal-best-confirmation-yes'].click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(history.length, 5);
    assert.equal(view.elements['#personal-best-page-indicator'].textContent, '1 / 1');
    assert.equal(view.elements['#personal-best-rows'].childrenList.length, 5);
    assert.equal(globalThis.document.activeElement, view.elements['#personal-best-rows'].childrenList[0].childrenList[5].childrenList[0]);
    view.component.destroy();
});

test('clear history confirms the count, disables empty/loading states, and shows the empty result', async () => {
    let history = records.slice(0, 3);
    let finishPage;
    let mutationCount = 0;
    const store = {
        getPage: () => new Promise(resolve => { finishPage = resolve; }),
        getBest: async () => ({ data: history[0] ?? null, error: null }),
        deleteResult: async () => ({ success: true, error: null }),
        clearHistory: async () => { mutationCount++; history = []; return { success: true, error: null }; }
    };
    const view = setup('signed-in', [], { store });
    view.elements['#game-menu-personal-best'].click();
    assert.equal(view.elements['#personal-best-clear-history'].disabled, true);
    finishPage({ data: { records: history, totalCount: history.length }, error: null });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(view.elements['#personal-best-clear-history'].disabled, false);
    view.elements['#personal-best-clear-history'].click();
    assert.match(view.elements['#personal-best-confirmation-message'].textContent, /all 3 results/);
    view.elements['#personal-best-confirmation-no'].click();
    assert.equal(mutationCount, 0);
    assert.equal(globalThis.document.activeElement, view.elements['#personal-best-clear-history']);
    view.elements['#personal-best-clear-history'].click();
    view.elements['#personal-best-confirmation-yes'].click();
    await new Promise(resolve => setImmediate(resolve));
    finishPage({ data: { records: [], totalCount: 0 }, error: null });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(mutationCount, 1);
    assert.equal(view.elements['#personal-best-table'].hidden, true);
    assert.equal(recordRows(view).length, 0);
    assert.equal(view.elements['#personal-best-status'].textContent, displayLabels.personalBestNoScores);
    assert.equal(view.elements['#personal-best-clear-history'].disabled, true);
    assert.equal(globalThis.document.activeElement, view.elements['#personal-best-close']);
    view.component.destroy();
});

test('mutation failure leaves rows and confirmation available and identity changes discard it', async () => {
    let finishMutation;
    const store = {
        getPage: async () => ({ data: { records: records.slice(0, 2), totalCount: 2 }, error: null }),
        getBest: async () => ({ data: records[0], error: null }),
        deleteResult: () => new Promise(resolve => { finishMutation = resolve; }),
        clearHistory: async () => ({ success: false, error: 'offline' })
    };
    const view = setup('signed-in', [], { store });
    view.elements['#game-menu-personal-best'].click();
    await new Promise(resolve => setImmediate(resolve));
    view.elements['#personal-best-rows'].childrenList[0].childrenList[5].childrenList[0].click();
    view.elements['#personal-best-confirmation-yes'].click();
    assert.equal(view.elements['#personal-best-confirmation-yes'].disabled, true);
    view.authChange({ status: 'signed-in', email: 'different@example.test' });
    assert.equal(view.elements['#personal-best-confirmation'].hidden, true);
    finishMutation({ success: false, error: 'old identity failure' });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(view.elements['#personal-best-confirmation-error'].textContent, '');
    assert.equal(view.elements['#personal-best-rows'].childrenList.length, 5);
    assert.equal(recordRows(view).length, 2);
    view.component.destroy();

    const failed = setup('signed-in', records.slice(0, 2), { store: {
        getPage: async () => ({ data: { records: records.slice(0, 2), totalCount: 2 }, error: null }),
        getBest: async () => ({ data: records[0], error: null }),
        deleteResult: async () => ({ success: true, error: null }),
        clearHistory: async () => ({ success: false, error: 'offline' })
    } });
    failed.elements['#game-menu-personal-best'].click();
    await new Promise(resolve => setImmediate(resolve));
    failed.elements['#personal-best-clear-history'].click();
    failed.elements['#personal-best-confirmation-yes'].click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(failed.elements['#personal-best-confirmation'].hidden, false);
    assert.equal(failed.elements['#personal-best-confirmation-error'].textContent, 'offline');
    assert.equal(failed.elements['#personal-best-rows'].childrenList.length, 5);
    assert.equal(recordRows(failed).length, 2);
    failed.component.destroy();
});

test('identity change clears private rows and ignores a stale page response', async () => {
    let finishStalePage;
    let calls = 0;
    const replacementRecord = { ...records[2], runId: 'new-player-run', finalCredits: 700, finalScore: 700 };
    const store = {
        getPage: page => {
            calls++;
            if (calls === 1) return Promise.resolve({ data: { records: records.slice(0, 5), totalCount: records.length }, error: null });
            if (calls === 2) return new Promise(resolve => { finishStalePage = resolve; });
            return Promise.resolve({ data: { records: [replacementRecord], totalCount: 1 }, error: null });
        },
        getBest: async () => ({ data: calls >= 3 ? replacementRecord : records[0], error: null })
    };
    const view = setup('signed-in', [], { store });
    view.elements['#game-menu-personal-best'].click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(view.elements['#personal-best-high-score'].textContent, '1500');
    view.elements['#personal-best-next'].click();
    view.authChange({ status: 'signed-in', email: 'different@example.test' });
    assert.equal(view.elements['#personal-best-rows'].childrenList.length, 5);
    assert.equal(recordRows(view).length, 0);
    assert.equal(view.elements['#personal-best-high-score'].textContent, '');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(view.elements['#personal-best-rows'].childrenList[0].childrenList[2].textContent, '700');
    finishStalePage({ data: { records: [records[5]], totalCount: records.length }, error: null });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(view.elements['#personal-best-rows'].childrenList[0].childrenList[0].textContent, '03 OCT 2026');
    assert.equal(view.elements['#personal-best-rows'].childrenList[0].childrenList[2].textContent, '700');
    view.component.destroy();
});

test('application UI setup mounts Personal Best with the authenticated history adapter and both entry controls', () => {
    const setupSource = readFileSync('src/ui/setupUi.ts', 'utf8');
    const componentSource = readFileSync('src/ui/components/personalBest.ts', 'utf8');
    assert.match(setupSource, /createBrowserResultHistoryStore/);
    assert.match(setupSource, /const resultHistoryStore = createBrowserResultHistoryStore\(\);[\s\S]*mountPersonalBest\(root, \{ store: resultHistoryStore, auth,/);
    assert.match(componentSource, /#game-over-personal-best/);
    assert.match(componentSource, /#game-menu-personal-best/);
});
