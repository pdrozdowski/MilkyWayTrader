import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

function transpile (path, imports) {
    const source = readFileSync(path, 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
    const module = { exports: {} };
    new Function('require', 'module', 'exports', compiled)(name => imports[name], module, module.exports);
    return module.exports;
}

const { displayLabels } = transpile('src/ui/components/displayLabels.ts', {});
const { mountGameIntro } = transpile('src/ui/components/gameIntro.ts', {
    '../contracts': {},
    './displayLabels': { displayLabels }
});

class Element {
    constructor (parent = null) { this.parent = parent; this.listeners = new Map(); this.attributes = {}; this.hidden = false; this.inert = false; this.textContent = ''; }
    addEventListener (name, listener) { this.listeners.set(name, listener); }
    removeEventListener (name) { this.listeners.delete(name); }
    setAttribute (name, value) { this.attributes[name] = value; }
    focus () { globalThis.document.activeElement = this; }
    closest (selector) {
        for (let node = this; node; node = node.parent) if (selector === '[hidden]' && node.hidden) return node;
        return null;
    }
    click () {
        const event = { target: this, stopped: false, stopPropagation () { this.stopped = true; }, preventDefault () {} };
        for (let node = this; node && !event.stopped; node = node.parent) node.listeners.get('click')?.(event);
    }
}

function setup (prepareNewGame) {
    const dialog = new Element();
    dialog.hidden = true;
    const story = new Element(dialog);
    const debt = new Element(dialog);
    const mainMenu = new Element();
    const ids = {
        '#game-intro': dialog,
        '#game-intro-title': new Element(dialog),
        '#game-intro-story': story,
        '#game-intro-story-description': new Element(story),
        '#game-intro-art': new Element(story),
        '#game-intro-story-advance': new Element(story),
        '#game-intro-previous': new Element(story),
        '#game-intro-next': new Element(story),
        '#game-intro-debt': debt,
        '#game-intro-debt-title': new Element(debt),
        '#game-intro-debt-amount': new Element(debt),
        '#game-intro-debt-goal': new Element(debt),
        '#game-intro-start': new Element(debt),
        '#main-menu': mainMenu,
        '#main-menu-new-game': new Element(mainMenu),
        '#app-content': new Element(),
        '#app-content-after': new Element()
    };
    const root = new Element();
    root.querySelector = selector => ids[selector] ?? null;
    root.querySelectorAll = selector => selector === '[data-app-content]' ? [ids['#app-content'], ids['#app-content-after']] : [];
    const listeners = new Map();
    const timers = new Map();
    let nextTimerId = 1;
    globalThis.window = {
        addEventListener: (name, listener) => listeners.set(name, listener),
        removeEventListener: name => listeners.delete(name),
        matchMedia: () => ({ matches: false }),
        setTimeout: callback => { const timerId = nextTimerId++; timers.set(timerId, callback); return timerId; },
        clearTimeout: timerId => timers.delete(timerId)
    };
    globalThis.document = { activeElement: ids['#main-menu-new-game'] };
    ids['#game-intro'].contains = element => element === ids['#game-intro-story-advance'] || element === ids['#game-intro-previous'] || element === ids['#game-intro-next'] || element === ids['#game-intro-start'];
    let starts = 0;
    const handle = mountGameIntro(root, { startGame: () => { starts += 1; }, prepareNewGame });
    return {
        ids,
        handle,
        listeners,
        starts: () => starts,
        flushTimers: () => {
            for (const [timerId, callback] of timers) {
                timers.delete(timerId);
                callback();
            }
        }
    };
}

test('intro requires four distinct advances and starts at most once after the debt panel', () => {
    const view = setup();
    const { ids } = view;
    ids['#main-menu-new-game'].click();
    assert.equal(ids['#game-intro'].hidden, true, 'opening waits for the initiating click to finish');
    view.flushTimers();
    assert.equal(ids['#main-menu'].inert, true);
    assert.equal(ids['#app-content-after'].inert, true);
    assert.equal(ids['#game-intro'].hidden, false);
    assert.equal(ids['#game-intro-art'].src, '/assets/story_art1.png');
    assert.equal(ids['#game-intro-next'].textContent, displayLabels.gameIntroNext);

    for (let slide = 1; slide < 4; slide += 1) {
        ids['#game-intro-story'].click();
        const expectedArtwork = ['/assets/story_art1.png', '/assets/story_art2.png', '/assets/story_art3.png', '/assets/story_art4_desktop.png'][slide];
        assert.equal(ids['#game-intro-art'].src, expectedArtwork);
    }
    ids['#game-intro-story'].click();
    assert.equal(ids['#game-intro-debt'].hidden, false);
    assert.equal(ids['#game-intro-debt-amount'].textContent, displayLabels.gameIntroDebtAmount);
    assert.equal(view.starts(), 0);
    ids['#game-intro'].click();
    view.listeners.get('keydown')({ key: 'Escape', preventDefault () {}, stopPropagation () {} });
    assert.equal(view.starts(), 0);

    ids['#game-intro-start'].click();
    ids['#game-intro-start'].click();
    assert.equal(view.starts(), 1);
    assert.equal(ids['#game-intro'].hidden, true);
    assert.equal(ids['#main-menu'].inert, false);
    assert.equal(ids['#app-content-after'].inert, false);
});

test('intro re-entry begins on the first panel and destroy removes installed listeners', () => {
    const view = setup();
    const { ids } = view;
    ids['#main-menu-new-game'].click();
    view.flushTimers();
    ids['#game-intro-story'].click();
    assert.equal(ids['#game-intro-art'].src, '/assets/story_art2.png');
    view.handle.destroy();
    assert.equal(view.listeners.has('keydown'), false);
    ids['#main-menu-new-game'].click();
    view.flushTimers();
    assert.equal(ids['#game-intro'].hidden, true);
});

test('destroy cancels an intro opened from a click that has not finished dispatching', () => {
    const view = setup();
    view.ids['#main-menu-new-game'].click();
    view.handle.destroy();
    view.flushTimers();
    assert.equal(view.ids['#game-intro'].hidden, true);
    assert.equal(view.ids['#app-content'].inert, false);
});

test('New Game waits for save resolution and does not open the intro after cancellation', async () => {
    let resolvePreparation;
    const view = setup(() => new Promise(resolve => { resolvePreparation = resolve; }));
    view.ids['#main-menu-new-game'].click();
    view.flushTimers();
    assert.equal(view.ids['#game-intro'].hidden, true);
    resolvePreparation(false);
    await Promise.resolve();
    await Promise.resolve();
    view.flushTimers();
    assert.equal(view.ids['#game-intro'].hidden, true);
    assert.equal(view.starts(), 0);
});

test('New Game opens the intro only after save preparation succeeds', async () => {
    let resolvePreparation;
    const view = setup(() => new Promise(resolve => { resolvePreparation = resolve; }));
    view.ids['#main-menu-new-game'].click();
    resolvePreparation(true);
    await Promise.resolve();
    await Promise.resolve();
    view.flushTimers();
    assert.equal(view.ids['#game-intro'].hidden, false);
});
