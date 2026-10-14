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
    constructor () { this.textContent = ''; this.hidden = false; this.disabled = false; this.listeners = new Map(); this.children = {}; this.isConnected = true; this.classList = { toggle () {} }; }
    addEventListener (name, fn) { this.listeners.set(name, fn); }
    removeEventListener (name) { this.listeners.delete(name); }
    click () { if (!this.disabled) this.listeners.get('click')?.(); }
    focus () { globalThis.document.activeElement = this; }
    append (...elements) { this.childrenList ??= []; this.childrenList.push(...elements); }
    replaceChildren (...elements) { this.childrenList = elements; }
    querySelector (selector) { return this.children[selector] ?? null; }
    querySelectorAll () { return (this.focusControls ?? Object.values(this.children)).filter(element => !element.hidden && !element.disabled); }
    setAttribute () {}
}

const ids = ['#personal-best', '#personal-best-title', '#personal-best-high-score', '#personal-best-status', '#personal-best-sign-in', '#personal-best-retry', '#personal-best-table', '#personal-best-rows', '#personal-best-date-heading', '#personal-best-score-heading', '#personal-best-outcome-heading', '#personal-best-best-heading', '#personal-best-delete-heading', '#personal-best-previous', '#personal-best-next', '#personal-best-page-indicator', '#personal-best-close', '#game-menu-personal-best', '#game-over-personal-best', '#game-menu'];
function setup (status = 'signed-in', pages = [], options = {}) {
    const elements = Object.fromEntries(ids.map(id => [id, new Element()]));
    elements['#personal-best'].focusControls = [elements['#personal-best-sign-in'], elements['#personal-best-retry'], elements['#personal-best-previous'], elements['#personal-best-next'], elements['#personal-best-close']];
    const root = new Element(); root.children = elements;
    let snapshot = { status, email: status === 'signed-in' ? 'pilot@example.test' : null };
    let listener;
    const auth = { getSnapshot: () => snapshot, subscribe: fn => { listener = fn; return () => {}; } };
    let calls = 0;
    const store = options.store ?? { getPage: async page => { calls++; return { data: { records: pages.slice(page * 5, page * 5 + 5), totalCount: pages.length }, error: null }; }, getBest: async () => ({ data: options.best ?? pages[0] ?? null, error: null }) };
    const opened = [];
    const windowListeners = new Map();
    globalThis.document = { activeElement: null, createElement: () => new Element() };
    globalThis.window = { addEventListener (name, fn) { windowListeners.set(name, fn); }, removeEventListener (name) { windowListeners.delete(name); } };
    const component = mountPersonalBest(root, { auth, store, profilePort: options.profilePort ?? { load: async () => ({ nickname: 'Pilot_7' }) }, openAccount: (...args) => opened.push(args) });
    return { elements, component, authChange: value => { snapshot = value; listener(value); }, opened, calls: () => calls, keydown: event => windowListeners.get('keydown')?.(event), root };
}

const records = Array.from({ length: 11 }, (_, index) => ({ runId: `run-${index}`, finalCredits: 100 - index, outcome: ['freedom', 'imprisonment', 'death', 'abandoned'][index % 4], savedAt: `2026-10-${String(index + 1).padStart(2, '0')}T12:00:00Z` }));
records[0] = { ...records[0], runId: 'tie-z', finalCredits: 1000, savedAt: '2026-10-01T12:00:00Z' };
records[10] = { ...records[10], runId: 'tie-a', finalCredits: 1000, savedAt: '2026-10-01T12:00:00Z' };

test('signed-out prompt reuses account flow, populated rows mark one best and deletion is inert', async () => {
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
    const bestMarkers = view.elements['#personal-best-rows'].childrenList.map(row => row.childrenList[3].textContent).filter(Boolean);
    assert.deepEqual(bestMarkers, []);
    assert.deepEqual(view.elements['#personal-best-rows'].childrenList.map(row => row.childrenList[2].textContent), [displayLabels.personalBestFreedom, displayLabels.personalBestPrison, displayLabels.personalBestDeath, displayLabels.personalBestAbandoned, displayLabels.personalBestFreedom]);
    assert.equal(view.elements['#personal-best-rows'].childrenList[0].childrenList[4].childrenList[0].disabled, true);
    const deleteButton = view.elements['#personal-best-rows'].childrenList[0].childrenList[4].childrenList[0];
    const requestsBeforeDelete = view.calls();
    deleteButton.click();
    assert.equal(deleteButton.listeners.has('click'), false);
    assert.equal(view.calls(), requestsBeforeDelete);
    assert.equal(view.elements['#personal-best-rows'].childrenList[0].childrenList[0].textContent, '01 OCT 2026');
    view.elements['#personal-best-next'].click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(view.elements['#personal-best-rows'].childrenList.length, 5);
    view.elements['#personal-best-next'].click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(view.elements['#personal-best-page-indicator'].textContent, '3 / 3');
    assert.equal(view.elements['#personal-best-rows'].childrenList.length, 1);
    assert.equal(view.elements['#personal-best-next'].disabled, true);
    const requestsAtLastPage = view.calls();
    view.elements['#personal-best-next'].click();
    assert.equal(view.elements['#personal-best-page-indicator'].textContent, '3 / 3');
    assert.equal(view.calls(), requestsAtLastPage);
    assert.deepEqual(view.elements['#personal-best-rows'].childrenList.map(row => row.childrenList[3].textContent).filter(Boolean), [displayLabels.personalBestBest]);
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
    assert.equal(failed.elements['#personal-best-rows'].childrenList.length, 1);
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
    assert.equal(view.elements['#personal-best-rows'].childrenList.length, 0);
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

    const first = view.elements['#personal-best-next'];
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

test('identity change clears private rows and ignores a stale page response', async () => {
    let finishStalePage;
    let calls = 0;
    const replacementRecord = { ...records[2], runId: 'new-player-run', finalCredits: 700 };
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
    assert.equal(view.elements['#personal-best-high-score'].textContent, '1000');
    view.elements['#personal-best-next'].click();
    view.authChange({ status: 'signed-in', email: 'different@example.test' });
    assert.equal(view.elements['#personal-best-rows'].childrenList.length, 0);
    assert.equal(view.elements['#personal-best-high-score'].textContent, '');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(view.elements['#personal-best-rows'].childrenList[0].childrenList[1].textContent, '700');
    finishStalePage({ data: { records: [records[5]], totalCount: records.length }, error: null });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(view.elements['#personal-best-rows'].childrenList[0].childrenList[0].textContent, '03 OCT 2026');
    assert.equal(view.elements['#personal-best-rows'].childrenList[0].childrenList[1].textContent, '700');
    view.component.destroy();
});

test('the title adds the signed-in player nickname and degrades to the plain title otherwise', async () => {
    const signedIn = setup('signed-in', records);
    signedIn.elements['#game-menu-personal-best'].click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(signedIn.elements['#personal-best-title'].textContent, '★ Pilot_7 - PERSONAL BEST ★');
    signedIn.elements['#personal-best-close'].click();
    assert.equal(signedIn.elements['#personal-best-title'].textContent, displayLabels.personalBestTitle);
    signedIn.component.destroy();

    const signedOut = setup('unsigned', records);
    signedOut.elements['#game-menu-personal-best'].click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(signedOut.elements['#personal-best-title'].textContent, displayLabels.personalBestTitle);
    signedOut.component.destroy();

    const noProfile = setup('signed-in', records, { profilePort: { load: async () => null } });
    noProfile.elements['#game-menu-personal-best'].click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(noProfile.elements['#personal-best-title'].textContent, displayLabels.personalBestTitle);
    noProfile.component.destroy();

    const failedProfile = setup('signed-in', records, { profilePort: { load: async () => { throw new Error('offline'); } } });
    failedProfile.elements['#game-menu-personal-best'].click();
    assert.equal(failedProfile.elements['#personal-best-title'].textContent, displayLabels.personalBestTitle);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(failedProfile.elements['#personal-best-title'].textContent, displayLabels.personalBestTitle);
    assert.equal(failedProfile.elements['#personal-best-rows'].childrenList.length, 5);
    failedProfile.component.destroy();
});

test('application UI setup mounts Personal Best with the authenticated history adapter and both entry controls', () => {
    const setupSource = readFileSync('src/ui/setupUi.ts', 'utf8');
    const componentSource = readFileSync('src/ui/components/personalBest.ts', 'utf8');
    assert.match(setupSource, /createBrowserResultHistoryStore/);
    assert.match(setupSource, /mountPersonalBest\(root, \{ store: createBrowserResultHistoryStore\(\), auth,/);
    assert.match(setupSource, /profilePort: auth\.createPlayerProfilePort/);
    assert.match(componentSource, /#game-over-personal-best/);
    assert.match(componentSource, /#game-menu-personal-best/);
});
