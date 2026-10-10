import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import ts from 'typescript';

function transpileModule (path, imports) {
    const source = readFileSync(path, 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
    const module = { exports: {} };
    new Function('require', 'module', 'exports', compiled)(name => imports[name], module, module.exports);
    return module.exports;
}

const { displayLabels } = transpileModule('src/ui/components/displayLabels.ts', {});
const { formatCredits } = transpileModule('src/ui/components/formatCredits.ts', {});
const { mountLandingStatus } = transpileModule('src/ui/components/landingStatus.ts', {
    './displayLabels': { displayLabels },
    './formatCredits': { formatCredits },
    './landingMenuHeader': { mountLandingMenuHeader: (backButton, clockElement, credits, cargo, timeControl, isActive, onBack, onToggleTime) => {
        const clockImage = new FakeElement();
        const clockValue = new FakeElement();
        const clock = { render: state => {
            const time = `${String(Math.floor(state.remainingSeconds / 60)).padStart(2, '0')}:${String(state.remainingSeconds % 60).padStart(2, '0')}`;
            clockValue.textContent = `${time} · ${state.runState === 'PAUSED' ? displayLabels.clockPaused : displayLabels.clockRunning}`;
            clockElement.textContent = clockValue.textContent;
            clockElement.setAttribute('aria-label', clockValue.textContent);
        }, destroy: () => {} };
        backButton?.addEventListener('click', onBack);
        timeControl.addEventListener('click', onToggleTime);
        return {
            backButton,
            render: state => {
                if (backButton) {
                    backButton.textContent = displayLabels.facilitiesBackToPlanet;
                    backButton.setAttribute('aria-label', displayLabels.facilitiesBackToPlanet);
                }
                clock.render(state.clock);
                credits.textContent = formatCredits(state.credits);
                cargo.textContent = `${state.cargoUsed} / ${state.cargoCapacity}`;
                timeControl.textContent = state.clock.playerPaused ? displayLabels.timePlay : displayLabels.timePause;
                timeControl.setAttribute('aria-label', timeControl.textContent);
                timeControl.setAttribute('aria-pressed', String(!state.clock.playerPaused));
                timeControl.dataset.playerPaused = String(state.clock.playerPaused);
            },
            destroy: () => { backButton?.removeEventListener('click', onBack); timeControl.removeEventListener('click', onToggleTime); clock.destroy(); }
        };
    } }
});

const documentStub = { activeElement: null, createElement: () => new FakeElement() };

class FakeElement {
    constructor (children = {}) {
        this.children = children;
        this.textContent = '';
        this.title = '';
        this.disabled = false;
        this.hidden = false;
        this.style = {};
        this.dataset = {};
        this.className = '';
        this.listeners = new Map();
        this.classList = { values: new Set(), toggle: (name, enabled) => enabled ? this.classList.values.add(name) : this.classList.values.delete(name) };
        this.attributes = {};
    }

    querySelector (selector) {
        return this.children[selector] ?? null;
    }

    querySelectorAll (selector) {
        const children = this.children[selector];
        return children ? (Array.isArray(children) ? children : [children]) : [];
    }

    addEventListener (type, listener) {
        this.listeners.set(type, listener);
    }

    setAttribute (name, value) {
        this.attributes[name] = value;
    }

    removeEventListener (type, listener) {
        if (this.listeners.get(type) === listener) this.listeners.delete(type);
    }

    replaceChildren (...nodes) {
        this.replacedChildren = nodes;
    }

    focus () {
        if (this.disabled) return;
        documentStub.activeElement = this;
    }

    click () {
        this.listeners.get('click')?.({ currentTarget: this });
    }
}

globalThis.window = { setInterval: () => 1, clearInterval: () => {}, addEventListener: () => {}, removeEventListener: () => {} };
globalThis.document = documentStub;
globalThis.HTMLImageElement = class HTMLImageElement {};

const placeholderIconIds = ['dairyFarm', 'grainFarm', 'cheeseFactory', 'bakery', 'foodProcessor'];
assert.ok(
    placeholderIconIds.every(id => existsSync(`public/assets/icons/facility-${id}_48x48.png`)),
    'every facility 48x48 icon asset exists'
);
const shipServiceIconIds = ['cargo', 'engine', 'weaponary', 'booster'];
assert.ok(
    shipServiceIconIds.every(id => existsSync(`public/assets/icons/shipService-${id}_48x48.png`)),
    'every ship-service 48x48 placeholder icon asset exists'
);
const shipyardStylesheet = readFileSync('public/style.css', 'utf8');
assert.ok(
    shipServiceIconIds.every(id => shipyardStylesheet.includes(`url('/assets/icons/shipService-${id}_48x48.png')`)),
    'every ship-service icon asset is wired to its card'
);

test('facilities view renders five cards with levels, states, recipes and actions from a fake port', () => {
    const selectors = [
        '#landing-status-commodity-name', '#landing-status-planet-stock', '#landing-status-supply', '#landing-status-production', '#landing-status-consumption', '#landing-status-stock-change', '#landing-status-player-stock', '#landing-status-player-stock-heading', '#landing-status-planet-stock-bar', '#landing-status-player-stock-bar',
        '#landing-status-average-buy-price', '#landing-status-trade-income', '#landing-status-trade-result', '#landing-status-quantity-label',
        '#landing-status-quantity', '#landing-status-quantity-value', '#landing-status-unit-price',
        '#landing-status-confirm', '#landing-status-launch', '#landing-status-market', '#landing-status-shipyard', '#landing-status-market-back',
        '.market-commodity-icon', '#landing-status-market-heading', '#landing-status-market-clock', '#landing-status-market-credits', '#landing-status-market-cargo',
        '#landing-status-title', '.landing-visual', '#landing-status-hub-back', '#landing-status-hub-clock', '#landing-status-hub-credits', '#landing-status-hub-cargo',
        '#landing-status-hub-time-control', '#landing-status-market-time-control', '#landing-status-facilities-time-control', '#landing-status-shipyard-time-control'
    ];
    const facilityIdList = ['dairyFarm', 'grainFarm', 'cheeseFactory', 'bakery', 'foodProcessor'];
    const cards = Object.fromEntries(facilityIdList.map(facilityId => [facilityId, new FakeElement({
        '.facility-card-name': new FakeElement(),
        '.facility-card-level': new FakeElement(),
        '.facility-card-status': new FakeElement(),
        '.facility-card-icon': new FakeElement(),
        '.facility-card-output': new FakeElement(),
        '.facility-card-inputs': new FakeElement(),
        '.facility-card-modifier': new FakeElement(),
        '.facility-card-action': new FakeElement({
            '.facility-card-action-label': new FakeElement(),
            '.facility-card-action-price': new FakeElement()
        }),
        '.facility-card-downgrade': new FakeElement({
            '.facility-card-downgrade-label': new FakeElement(),
            '.facility-card-downgrade-refund': new FakeElement({
                '.facility-card-downgrade-refund-label': new FakeElement(),
                '.facility-card-downgrade-coin': new FakeElement(),
                '.facility-card-downgrade-amount': new FakeElement()
            })
        })
    })]));
    const modal = new FakeElement();
    const hub = new FakeElement();
    const marketView = new FakeElement();
    const facilitiesView = new FakeElement(Object.fromEntries(facilityIdList.map(facilityId => [`[data-facility-id="${facilityId}"]`, cards[facilityId]])));
    const shipyardView = new FakeElement({
        '.shipyard-repair-card': new FakeElement(Object.fromEntries(['.shipyard-card-name', '.shipyard-repair-icon', '.shipyard-repair-hp', '.shipyard-repair-bar', '.shipyard-repair-increment'].map(selector => [selector, new FakeElement()]))),
        '[data-booster-row]': new FakeElement({
            ...Object.fromEntries(['.shipyard-card-icon', '.shipyard-card-name', '.shipyard-card-effect'].map(selector => [selector, new FakeElement()])),
            '.shipyard-card-availability': new FakeElement({ '.shipyard-card-availability-state': new FakeElement(), '.shipyard-card-availability-label': new FakeElement(), '.shipyard-card-availability-planet': new FakeElement() }),
            '.shipyard-card-action': new FakeElement({ '.shipyard-card-action-label': new FakeElement(), '.shipyard-card-action-price': new FakeElement() })
        })
    });
    const facilitiesHeading = new FakeElement();
    const facilitiesBack = new FakeElement();
    const facilitiesClock = new FakeElement();
    const facilitiesCredits = new FakeElement();
    const facilitiesCargo = new FakeElement();
    const facilitiesButton = new FakeElement();
    const catalogueName = new FakeElement();
    const catalogueButton = new FakeElement({ '.catalogue-commodity-name': catalogueName });
    catalogueButton.dataset.commodityId = 'milk';
    const root = new FakeElement({
        ...Object.fromEntries(selectors.map(selector => [selector, new FakeElement()])),
        '#landing-status': modal,
        '#landing-status-confirm': new FakeElement({ '.market-confirm-label': new FakeElement(), '.market-confirm-price': new FakeElement() }),
        '#landing-status-planet-stock-bar': new FakeElement({
            '.market-stock-segment--low': new FakeElement({ '.market-stock-fill': new FakeElement() }),
            '.market-stock-segment--medium': new FakeElement({ '.market-stock-fill': new FakeElement() }),
            '.market-stock-segment--high': new FakeElement({ '.market-stock-fill': new FakeElement() })
        }),
        '#landing-status-player-stock-bar': new FakeElement({ '.market-stock-fill': new FakeElement() }),
        '#landing-status-hub': hub,
        '#landing-status-hub-clock': new FakeElement(),
        '#landing-status-hub-credits': new FakeElement(),
        '#landing-status-hub-cargo': new FakeElement(),
        '#landing-status-hub-time-control': new FakeElement(),
        '#landing-status-market-view': marketView,
        '#landing-status-facilities-view': facilitiesView,
        '#landing-status-facilities-heading': facilitiesHeading,
        '#landing-status-facilities-back': facilitiesBack,
        '#landing-status-facilities-clock': facilitiesClock,
        '#landing-status-facilities-credits': facilitiesCredits,
        '#landing-status-facilities-cargo': facilitiesCargo,
        '#landing-status-facilities': facilitiesButton,
        '#landing-status-shipyard-view': shipyardView,
        '#landing-status-shipyard-heading': new FakeElement(),
        '#landing-status-shipyard-planet': new FakeElement(),
        '#landing-status-shipyard-back': new FakeElement(),
        '#landing-status-shipyard-clock': new FakeElement(),
        '#landing-status-shipyard-credits': new FakeElement(),
        '#landing-status-shipyard-cargo': new FakeElement(),
        '#landing-status-shipyard-repair': new FakeElement({ '.shipyard-card-action-label': new FakeElement(), '.shipyard-card-action-price': new FakeElement() }),
        '#landing-status-catalogue > button[data-commodity-id]': [catalogueButton]
    });
    const initialLevelOf = facilityId => ['dairyFarm', 'grainFarm', 'cheeseFactory'].includes(facilityId) ? 1 : 0;
    const row = (facilityId, label, level, status, outputCommodityId, outputPerCycle, inputsPerCycle, modifier, action, buildOutputPerCycle = outputPerCycle || 5, buildInputsPerCycle = inputsPerCycle) =>
        ({ facilityId, label, level, initialLevel: initialLevelOf(facilityId), maxLevel: 3, status, outputCommodityId, outputPerCycle, inputsPerCycle, buildOutputPerCycle, buildInputsPerCycle, modifier, action, downgrade: { available: level > initialLevelOf(facilityId), targetLevel: Math.max(initialLevelOf(facilityId), level - 1), refund: level > initialLevelOf(facilityId) ? 75_000 : 0 } });
    const noModifier = { upgradePriceMultiplier: 1, outputMultiplier: 1 };
    const baseFacilities = [
    row('dairyFarm', 'Dairy Farm', 1, 'working', 'milk', 10, [], noModifier, { kind: 'upgrade', targetLevel: 2, price: 25_000, affordable: true }),
    row('grainFarm', 'Grain Farm', 1, 'insufficientResources', 'grain', 10, [], noModifier, { kind: 'upgrade', targetLevel: 2, price: 25_000, affordable: true }),
    row('cheeseFactory', 'Cheese Factory', 1, 'working', 'cheese', 6, [{ commodityId: 'milk', quantity: 12 }], { upgradePriceMultiplier: 0.8, outputMultiplier: 1.2 }, { kind: 'upgrade', targetLevel: 2, price: 28_000, affordable: true }),
    row('bakery', 'Bakery', 0, 'notBuilt', 'bun', 0, [], noModifier, { kind: 'build', targetLevel: 1, price: 35_000, affordable: true }, 5, [{ commodityId: 'grain', quantity: 10 }]),
    row('foodProcessor', 'Food Processor', 3, 'working', 'spaceRation', 20, [{ commodityId: 'cheese', quantity: 40 }], noModifier, { kind: 'max', targetLevel: 3, price: 0, affordable: true })
    ];
    const facilitiesSnapshot = credits => ({
        visible: true, eligible: true, planetId: 'seroton', planetName: 'Seroton',
        credits, cargoUsed: 3, cargoCapacity: 20,
        clock: { remainingSeconds: 754, runState: 'PAUSED', playerPaused: true },
        facilities: baseFacilities.map(facility => ({ ...facility, action: { ...facility.action, affordable: facility.action.kind === 'max' || facility.action.price <= credits } }))
    });
    const emptyShipyardSnapshot = {
        visible: false, eligible: false, planetId: null, planetName: null, credits: 0, cargoUsed: 0, cargoCapacity: 0,
        clock: { remainingSeconds: 0, runState: 'RUNNING', playerPaused: true },
        repair: { currentHitPoints: 100, maximumHitPoints: 100, incrementHitPoints: 10, price: 1_000, failure: 'not-landed' },
        services: [],
        booster: { owned: false, price: 75_000, servicePlanetId: 'lactozis-7c', servicePlanetName: 'Lactozis-7C', available: false, affordable: false, failure: 'not-landed' }
    };
    const commodity = { commodityId: 'milk', stock: 400, stockCapacity: 400, lowerStockThreshold: 100, upperStockThreshold: 300, carriedQuantity: 0, unitPrice: 100, averageBuyPrice: 0, netPerSecond: -2 };
    const marketSnapshot = {
        visible: true, eligible: true, planetId: 'seroton', planetName: 'Seroton', credits: 1_000_000,
        cargoUsed: 3, cargoCapacity: 20, commodities: [commodity], selectedCommodityId: 'milk', tradeQuantity: 0,
        selectedCommodity: commodity, plannedStockDelta: 0, plannedCargoDelta: 0, supplyLevel: 'Medium',
        clock: { remainingSeconds: 754, runState: 'PAUSED', playerPaused: true },
        commodityFlow: { productionPerSecond: 10, consumptionPerSecond: 12, netPerSecond: -2 },
        quote: { quantity: 0, total: 0, failure: null, postTradeStock: 400, nextUnitPrice: 100 }
    };
    let marketListener = null;
    let facilitiesListener = null;
    let shipyardListener = null;
    let marketUnsubscribes = 0;
    let facilitiesUnsubscribes = 0;
    let portDestroyed = 0;
    const builds = [];
    const upgrades = [];
    const downgrades = [];
    const toggles = [];
    const port = {
        getSnapshot: () => marketSnapshot,
        subscribe: next => { marketListener = next; next(marketSnapshot); return () => { marketUnsubscribes++; }; },
        getFacilitiesSnapshot: () => facilitiesSnapshot(1_000_000),
        subscribeFacilities: next => { facilitiesListener = next; next(facilitiesSnapshot(1_000_000)); return () => { facilitiesUnsubscribes++; }; },
        getShipyardSnapshot: () => emptyShipyardSnapshot,
        subscribeShipyard: next => { shipyardListener = next; next(emptyShipyardSnapshot); return () => {}; },
        selectCommodity: () => {},
        setTradeQuantity: () => {},
        confirmTrade: () => {},
        buildFacility: facilityId => builds.push(facilityId),
        upgradeFacility: facilityId => upgrades.push(facilityId),
        downgradeFacility: facilityId => downgrades.push(facilityId),
        togglePlayerPause: () => toggles.push('toggle-time'),
        launch: () => {},
        destroy: () => { portDestroyed++; }
    };
    const handle = mountLandingStatus(root, port);
    const element = selector => root.querySelector(selector);
    const timeControls = ['#landing-status-hub-time-control', '#landing-status-market-time-control', '#landing-status-facilities-time-control', '#landing-status-shipyard-time-control'].map(element);
    assert(timeControls.every(button => button.textContent === displayLabels.timePlay), 'each planet view starts with the Play action');
    marketListener({ ...marketSnapshot, clock: { ...marketSnapshot.clock, runState: 'PAUSED', playerPaused: false } });
    facilitiesListener({ ...facilitiesSnapshot(1_000_000), clock: { remainingSeconds: 754, runState: 'PAUSED', playerPaused: false } });
    shipyardListener({ ...emptyShipyardSnapshot, visible: true, clock: { remainingSeconds: 754, runState: 'PAUSED', playerPaused: false } });
    assert(timeControls.every(button => button.textContent === displayLabels.timePause && button.attributes['aria-pressed'] === 'true'),
        'environmental blockers hold the clock while all views retain the player-selected Pause action state');
    timeControls.forEach(button => button.click());
    assert.equal(toggles.length, 4, 'each time control routes through the shared player toggle action');
    assert.equal(element('#landing-status-hub-credits').textContent, '1,000,000');
    assert.equal(element('#landing-status-hub-cargo').textContent, '3 / 20');
    assert(element('#landing-status-hub-clock').textContent.startsWith('12:34 '), 'the hub projects the active clock');
    const landingMarkup = readFileSync('index.html', 'utf8');
    const hubHeaderMarkup = landingMarkup.match(/<header class="landing-facilities-header">([\s\S]*?)<\/header>/)?.[1] ?? '';
    assert.match(hubHeaderMarkup, /landing-status-hub-back[^>]*hidden/, 'the hub reuses the shared header with its Back button hidden');
    assert.match(hubHeaderMarkup, /landing-facilities-nav-left[\s\S]*?landing-status-hub-time-control[\s\S]*?landing-facilities-nav-right[\s\S]*?landing-status-hub-credits[\s\S]*?landing-status-hub-cargo/,
        'the hub header uses the shared left clock/control and right resource layout');
    assert.equal((landingMarkup.match(/class="landing-facilities-header"/g) ?? []).length, 4, 'all planet views use the same shared header structure');
    assert.match(shipyardStylesheet, /\.landing-facilities-header \{[^}]*width: 100%/, 'the shared header fills its menu width');
    assert.match(shipyardStylesheet, /\.landing-facilities-nav-left \{ flex: 1 1 100%; gap: 8px; \}/, 'narrow layouts keep the clock and control together on the left');
    assert.match(shipyardStylesheet, /\.landing-facilities-nav-right \{ flex: 1 1 100%; justify-content: flex-end; gap: 6px; \}/, 'narrow layouts wrap resources onto a right-aligned row');
    assert.match(landingMarkup, /<nav class="landing-actions" aria-label="Planet services">/, 'the hub retains the accessible Planet services navigation');
    assert.equal(element('#landing-status-supply').textContent, `${displayLabels.supply}: Medium`);
    assert.equal(element('#landing-status-supply').dataset.supplyLevel, 'Medium');
    marketListener({ ...marketSnapshot, supplyLevel: 'Low' });
    assert.equal(element('#landing-status-supply').dataset.supplyLevel, 'Low');
    marketListener({ ...marketSnapshot, supplyLevel: 'High' });
    assert.equal(element('#landing-status-supply').dataset.supplyLevel, 'High');
    marketListener(marketSnapshot);
    assert.equal(element('#landing-status-production').textContent, `${displayLabels.marketProduction}: 10 ${displayLabels.commodityLabels.milk} ${displayLabels.facilityPerCycle}`);
    assert.equal(element('#landing-status-consumption').textContent, `${displayLabels.marketConsumption}: 12 ${displayLabels.commodityLabels.milk} ${displayLabels.facilityPerCycle}`);
    assert.equal(element('#landing-status-stock-change').replacedChildren[0].textContent, `${displayLabels.marketStockChange}:`);
    assert.equal(element('#landing-status-stock-change').replacedChildren[1].textContent, '-2/s');
    const planetBar = element('#landing-status-planet-stock-bar');
    assert.equal(planetBar.querySelector('.market-stock-segment--low').querySelector('.market-stock-fill').style.width, '100%');
    assert.equal(planetBar.querySelector('.market-stock-segment--medium').querySelector('.market-stock-fill').style.width, '100%');
    assert.equal(planetBar.querySelector('.market-stock-segment--high').querySelector('.market-stock-fill').style.width, '100%');
    assert.equal(planetBar.querySelector('.market-stock-segment--low').style.flex, '0 0 25%');
    assert.equal(planetBar.querySelector('.market-stock-segment--medium').style.flex, '0 0 50%');
    assert.equal(planetBar.querySelector('.market-stock-segment--high').style.flex, '0 0 25%');
    assert.equal(element('#landing-status-planet-stock-bar').attributes['aria-valuetext'], '400 of 400');
    marketListener({ ...marketSnapshot, quote: { ...marketSnapshot.quote, postTradeStock: 150 } });
    assert.equal(planetBar.querySelector('.market-stock-segment--low').querySelector('.market-stock-fill').style.width, '100%');
    assert.equal(planetBar.querySelector('.market-stock-segment--medium').querySelector('.market-stock-fill').style.width, '25%');
    assert.equal(planetBar.querySelector('.market-stock-segment--high').querySelector('.market-stock-fill').style.width, '0%');
    marketListener(marketSnapshot);
    assert.equal(element('#landing-status-player-stock-bar').querySelector('.market-stock-fill').style.width, '0%');
    assert.equal(element('#landing-status-player-stock-bar').attributes['aria-valuemax'], '20');
    const confirmButton = element('#landing-status-confirm');
    assert.equal(confirmButton.querySelector('.market-confirm-label').textContent, displayLabels.marketConfirm);
    assert.equal(confirmButton.querySelector('.market-confirm-price').textContent, '0');
    assert.equal(confirmButton.disabled, false);
    marketListener({ ...marketSnapshot, credits: 1_000, quote: { ...marketSnapshot.quote, total: 2_000, failure: 'insufficient-credits' } });
    assert.equal(confirmButton.querySelector('.market-confirm-label').textContent, displayLabels.marketInsufficientCash);
    assert.equal(confirmButton.querySelector('.market-confirm-price').textContent, '1,000');
    assert.equal(confirmButton.querySelector('.market-confirm-price').dataset.state, 'insufficient-credits');
    assert.equal(confirmButton.disabled, true);
    marketListener({ ...marketSnapshot, tradeQuantity: 1, credits: 17_000, quote: { ...marketSnapshot.quote, total: 37_000, failure: null } });
    assert.equal(confirmButton.querySelector('.market-confirm-label').textContent, displayLabels.marketInsufficientCash);
    assert.equal(confirmButton.querySelector('.market-confirm-price').textContent, '20,000');
    assert.equal(confirmButton.querySelector('.market-confirm-price').dataset.state, 'insufficient-credits');
    assert.equal(confirmButton.disabled, true);
    marketListener(marketSnapshot);
    assert(element('#landing-status-stock-change').classList.values.has('market-stock-delta--negative'), 'a net decrease is flagged negative');
    assert(!element('#landing-status-stock-change').classList.values.has('market-stock-delta--positive'), 'a net decrease is not flagged positive');
    assert.equal(element('#landing-status-market-credits').textContent, (1_000_000).toLocaleString('en-US'));
    assert.equal(element('#landing-status-market-cargo').textContent, '3 / 20');
    assert.equal(element('#landing-status-commodity-name').textContent, `${displayLabels.planetaryStockOf}: ${displayLabels.commodityLabels.milk}`);
    assert.equal(element('#landing-status-player-stock-heading').textContent, `${displayLabels.shipStockOf}: ${displayLabels.commodityLabels.milk}`);
    assert.equal(element('.market-commodity-icon').dataset.commodityId, marketSnapshot.selectedCommodityId);
    assert.equal(element('.market-commodity-icon').textContent, '');
    assert.equal(catalogueName.textContent, `${displayLabels.commodityLabels.milk} (-2/s)`, 'a catalogue button shows the commodity label and its signed stock-change rate');
    marketListener({ ...marketSnapshot, commodities: [{ ...commodity, netPerSecond: 10 }] });
    assert.equal(catalogueName.textContent, `${displayLabels.commodityLabels.milk} (+10/s)`, 'a positive stock-change rate receives an explicit plus sign');
    marketListener(marketSnapshot);
    assert.equal(catalogueButton.attributes['aria-pressed'], 'true', 'the selected catalogue button is pressed');
    assert.equal(catalogueButton.disabled, false, 'an eligible catalogue button stays enabled');
    const marketClock = element('#landing-status-market-clock');
    assert(marketClock.textContent.startsWith('12:34 '), 'the market header shows the run clock');
    assert(marketClock.textContent.endsWith(` ${displayLabels.clockPaused}`), 'the market clock shows the paused run state');
    assert.equal(marketClock.attributes['aria-label'], marketClock.textContent);
    assert.equal(element('#landing-status-market-back').textContent, displayLabels.facilitiesBackToPlanet);
    assert.equal(element('#landing-status-market-back').attributes['aria-label'], displayLabels.facilitiesBackToPlanet);
    const incomeNodes = () => element('#landing-status-trade-income').replacedChildren ?? [];
    const incomeText = () => incomeNodes().map(child => child.textContent).join('');
    const resultNodes = () => element('#landing-status-trade-result').replacedChildren ?? [];
    const resultText = () => resultNodes().map(child => child.textContent).join(' ');
    marketListener({ ...marketSnapshot, tradeQuantity: -3, quote: { ...marketSnapshot.quote, total: 1_234_500 } });
    assert.equal(incomeText(), `${displayLabels.tradeIncome}: +1,234,500`, 'a sale shows the income label and a comma-separated amount');
    assert(!incomeText().includes('cr'), 'the trade income amount carries no credit suffix');
    assert.ok(incomeNodes().some(child => child.className === 'market-trade-income-value'), 'the trade income amount has its own value span for the coin icon');
    assert(!incomeNodes().some(child => child.className.includes('market-trade-income-value--expense')), 'a sale keeps the neutral coin icon');
    assert.equal(resultText(), `${displayLabels.profit} +1,234,500`, 'a profitable sale shows the profit label and a comma-separated amount');
    assert(!resultText().includes('cr'), 'the trade result amount carries no credit suffix');
    assert.ok(resultNodes().some(child => child.className === 'market-trade-result-value'), 'the trade result amount has its own value span for the coin icon on its own row');
    marketListener({ ...marketSnapshot, tradeQuantity: -2, selectedCommodity: { ...commodity, averageBuyPrice: 700_000 }, quote: { ...marketSnapshot.quote, total: 1_000 } });
    assert.equal(resultText(), `${displayLabels.loss} -1,399,000`, 'a losing sale shows the loss label and a comma-separated negative amount');
    marketListener({ ...marketSnapshot, tradeQuantity: 4, quote: { ...marketSnapshot.quote, total: 2_000 } });
    assert.equal(incomeText(), `${displayLabels.expense}: -2,000`, 'a purchase shows the expense label and a comma-separated amount');
    assert.ok(incomeNodes().some(child => child.className === 'market-trade-income-value market-trade-income-value--expense'), 'a purchase marks the income value for the red coin icon');
    assert.equal(resultText(), '', 'a purchase clears the trade result readout');
    marketListener({ ...marketSnapshot, tradeQuantity: 0 });
    assert.equal(incomeNodes().length, 0, 'no trade clears the trade income readout');
    marketListener({ ...marketSnapshot, tradeQuantity: -3, selectedCommodity: { ...commodity, averageBuyPrice: 100.1 }, quote: { ...marketSnapshot.quote, total: 100 } });
    assert.equal(resultText(), `${displayLabels.loss} -200`, 'a fractional loss rounds to whole credits');
    marketListener({ ...marketSnapshot, credits: 1_234.7 });
    assert.equal(element('#landing-status-market-credits').textContent, '1,235', 'a fractional cash balance rounds to whole credits');
    marketListener({ ...marketSnapshot, tradeQuantity: 3, selectedCommodity: { ...commodity, carriedQuantity: 2, averageBuyPrice: 100.5 }, quote: { ...marketSnapshot.quote, total: 300 } });
    assert.equal(element('#landing-status-average-buy-price').textContent, `${displayLabels.averageBuyPrice}: 251`, 'the average buy price shows whole credits with no currency suffix');
    marketListener(marketSnapshot);
    const name = facilityId => cards[facilityId].querySelector('.facility-card-name');
    const level = facilityId => cards[facilityId].querySelector('.facility-card-level');
    const status = facilityId => cards[facilityId].querySelector('.facility-card-status');
    const output = facilityId => cards[facilityId].querySelector('.facility-card-output');
    const inputs = facilityId => cards[facilityId].querySelector('.facility-card-inputs');
    const modifier = facilityId => cards[facilityId].querySelector('.facility-card-modifier');
    const action = facilityId => cards[facilityId].querySelector('.facility-card-action');
    const actionLabel = facilityId => action(facilityId).querySelector('.facility-card-action-label');
    const actionPrice = facilityId => action(facilityId).querySelector('.facility-card-action-price');
    const downgrade = facilityId => cards[facilityId].querySelector('.facility-card-downgrade');
    const downgradeLabel = facilityId => downgrade(facilityId).querySelector('.facility-card-downgrade-label');
    const downgradeRefundLabel = facilityId => downgrade(facilityId).querySelector('.facility-card-downgrade-refund').querySelector('.facility-card-downgrade-refund-label');
    const downgradeCoin = facilityId => downgrade(facilityId).querySelector('.facility-card-downgrade-refund').querySelector('.facility-card-downgrade-coin');
    const downgradeAmount = facilityId => downgrade(facilityId).querySelector('.facility-card-downgrade-refund').querySelector('.facility-card-downgrade-amount');
    const textOf = element => (element.replacedChildren ?? []).map(child => child.textContent).join('');

    const renderedFacilities = facilitiesSnapshot(1_000_000).facilities;
    const populatedCards = renderedFacilities.filter(facility =>
        name(facility.facilityId).textContent !== '' && status(facility.facilityId).textContent !== '');
    assert.equal(populatedCards.length, 5, 'the component populates a name and status for all five facility cards');
    for (const facility of facilitiesSnapshot(1_000_000).facilities) {
        assert.equal(name(facility.facilityId).textContent, facility.label);
        assert.equal(level(facility.facilityId).textContent, `${displayLabels.facilityLevel} ${facility.level} / 3`);
        assert.equal(status(facility.facilityId).textContent, displayLabels.facilityStatusLabels[facility.status]);
        assert.equal(status(facility.facilityId).dataset.status, facility.status);
    }
    assert.equal(status('dairyFarm').textContent, displayLabels.facilityStatusLabels.working);
    assert.equal(status('grainFarm').textContent, displayLabels.facilityStatusLabels.insufficientResources);
    assert.equal(textOf(output('grainFarm')), `${displayLabels.facilityProduces}: 10 ${displayLabels.commodityLabels.grain} ${displayLabels.facilityPerCycle} ${displayLabels.facilityMissing}`);
    assert.ok((output('grainFarm').replacedChildren ?? []).some(child => child.className === 'facility-card-missing'), 'missing resources add a visible missing marker to production');
    assert.equal(status('bakery').textContent, displayLabels.facilityStatusLabels.notBuilt);
    assert.equal(textOf(output('bakery')), `${displayLabels.facilityProduces}: 5 ${displayLabels.commodityLabels.bun} ${displayLabels.facilityPerCycle}`);
    assert.equal(textOf(inputs('bakery')), `${displayLabels.facilityConsumes}: 10 ${displayLabels.commodityLabels.grain} ${displayLabels.facilityPerCycle}`);
    assert.equal(textOf(output('dairyFarm')), `${displayLabels.facilityProduces}: 10 ${displayLabels.commodityLabels.milk} ${displayLabels.facilityPerCycle}`);
    assert.equal(inputs('dairyFarm').textContent, displayLabels.facilityNoInputs);
    assert(inputs('dairyFarm').classList.values.has('facility-card-recipe-empty'), 'the No inputs message is gray');
    const iconIds = element => (element.replacedChildren ?? []).filter(child => child.className.includes('facility-card-commodity-icon')).map(child => child.dataset.commodityId);
    assert.deepEqual(iconIds(output('dairyFarm')), ['milk'], 'the produced commodity renders a small commodity icon');
    assert.deepEqual(iconIds(inputs('cheeseFactory')), ['milk'], 'the consumed commodity renders a small commodity icon');
    assert.equal(textOf(inputs('cheeseFactory')), `${displayLabels.facilityConsumes}: 12 ${displayLabels.commodityLabels.milk} ${displayLabels.facilityPerCycle}`);
    assert.equal(modifier('dairyFarm').textContent, '');
    assert.equal(modifier('dairyFarm').hidden, true);
    assert.equal(modifier('cheeseFactory').textContent, `${displayLabels.facilityOutputBonus} +20% · ${displayLabels.facilityUpgradeDiscount} 20%`);
    assert.equal(modifier('cheeseFactory').hidden, false);
    assert.equal(actionLabel('bakery').textContent, displayLabels.facilityBuild);
    assert.equal(action('bakery').dataset.action, 'build');
    assert.equal(action('bakery').attributes['aria-label'], `Bakery: ${displayLabels.facilityBuild}`);
    assert.equal(actionPrice('bakery').textContent, (35_000).toLocaleString('en-US'));
    assert.equal(action('bakery').disabled, false);
    assert.equal(action('dairyFarm').querySelector('.facility-card-action-label').textContent, displayLabels.facilityUpgrade);
    assert.equal(action('dairyFarm').dataset.action, 'upgrade');
    assert.equal(action('dairyFarm').attributes['aria-label'], `Dairy Farm: ${displayLabels.facilityUpgrade}`);
    assert.equal(action('foodProcessor').querySelector('.facility-card-action-label').textContent, displayLabels.facilityMaxLevel);
    assert.equal(action('foodProcessor').dataset.action, 'max');
    assert.equal(action('foodProcessor').attributes['aria-label'], `Food Processor: ${displayLabels.facilityMaxLevel}`);
    assert.equal(action('foodProcessor').disabled, false);
    assert.equal(actionPrice('foodProcessor').textContent, '');
    assert.equal(actionPrice('foodProcessor').hidden, true);
    assert.equal(downgradeLabel('dairyFarm').textContent, displayLabels.facilityDowngrade);
    assert.equal(downgradeRefundLabel('dairyFarm').textContent, displayLabels.facilityDowngradeUnavailable);
    assert.equal(downgradeCoin('dairyFarm').hidden, true);
    assert.equal(downgrade('dairyFarm').disabled, true, 'a facility at its starting level cannot be downgraded');
    assert.equal(downgrade('foodProcessor').disabled, false);
    assert.equal(downgradeRefundLabel('foodProcessor').textContent, `${displayLabels.facilityRefund} - `);
    assert.equal(downgradeCoin('foodProcessor').hidden, false);
    assert.equal(downgradeAmount('foodProcessor').textContent, '75,000');
    const unbuiltProcessor = baseFacilities.map(facility => facility.facilityId === 'foodProcessor'
        ? { ...facility, level: 0, status: 'notBuilt', outputPerCycle: 0, inputsPerCycle: [], buildOutputPerCycle: 5, action: { kind: 'build', targetLevel: 1, price: 75_000, affordable: true } }
        : facility);
    unbuiltProcessor.find(facility => facility.facilityId === 'foodProcessor').buildInputsPerCycle = [
        { commodityId: 'cheese', quantity: 10 },
        { commodityId: 'bun', quantity: 5 },
        { commodityId: 'milk', quantity: 5 }
    ];
    facilitiesListener({ ...facilitiesSnapshot(1_000_000), facilities: unbuiltProcessor });
    assert.equal(textOf(output('foodProcessor')), `${displayLabels.facilityProduces}: 5 ${displayLabels.commodityLabels.spaceRation} ${displayLabels.facilityPerCycle}`);
    assert.equal(textOf(inputs('foodProcessor')), `${displayLabels.facilityConsumes}: 10 ${displayLabels.commodityLabels.cheese} + 5 ${displayLabels.commodityLabels.bun} + 5 ${displayLabels.commodityLabels.milk} ${displayLabels.facilityPerCycle}`);
    facilitiesListener(facilitiesSnapshot(1_000_000));
    assert.equal(facilitiesBack.textContent, displayLabels.facilitiesBackToPlanet);
    assert.equal(facilitiesBack.attributes['aria-label'], displayLabels.facilitiesBackToPlanet);
    assert.equal(facilitiesHeading.textContent, displayLabels.facilities);
    assert.equal(facilitiesClock.textContent, `12:34 · ${displayLabels.clockPaused}`);
    assert.equal(facilitiesClock.attributes['aria-label'], `12:34 · ${displayLabels.clockPaused}`);
    assert.equal(facilitiesCredits.textContent, (1_000_000).toLocaleString('en-US'));
    assert.equal(facilitiesCargo.textContent, '3 / 20');
    assert.equal(cards['dairyFarm'].querySelector('.facility-card-icon').textContent, '');
    assert.equal(cards['dairyFarm'].querySelector('.facility-card-icon').attributes['aria-label'], `${displayLabels.commodityLabels.milk}${displayLabels.commodityIconSuffix}`);

    action('bakery').click();
    action('dairyFarm').click();
    action('foodProcessor').click();
    downgrade('foodProcessor').click();
    assert.deepEqual(builds, ['bakery']);
    assert.deepEqual(upgrades, ['dairyFarm']);
    assert.deepEqual(downgrades, ['foodProcessor']);

    assert.notEqual(marketListener, null);
    facilitiesButton.click();
    assert.equal(documentStub.activeElement, action('dairyFarm'));

    facilitiesListener(facilitiesSnapshot(1_000));
    assert.equal(action('bakery').disabled, true);
    assert.equal(action('dairyFarm').disabled, true);
    assert.equal(action('foodProcessor').disabled, false);

    facilitiesButton.click();
    assert.equal(documentStub.activeElement, facilitiesBack, 'an unaffordable first action moves focus to the always-enabled Back control');
    assert.equal(facilitiesBack.disabled, false);

    element('#landing-status-market-back').click();
    assert.equal(marketView.hidden, true, 'the market header Back returns to the hub');
    assert.equal(hub.hidden, false);
    assert.equal(documentStub.activeElement, element('#landing-status-market'), 'returning to the hub refocuses the Market button');

    handle.destroy();
    handle.destroy();
    assert(timeControls.every(button => !button.listeners.has('click')), 'all four time control listeners are removed on teardown');
    assert.equal(marketUnsubscribes, 1, 'teardown unsubscribes the market listener exactly once');
    assert.equal(facilitiesUnsubscribes, 1, 'teardown unsubscribes the facilities listener exactly once');
    assert.equal(portDestroyed, 1, 'teardown destroys the port exactly once');
    for (const facilityId of facilityIdList) {
        assert.equal(action(facilityId).listeners.size, 0);
        assert.equal(downgrade(facilityId).listeners.size, 0);
    }
    assert.equal(facilitiesButton.listeners.size, 0);
    assert.equal(facilitiesBack.listeners.size, 0);
});
test('the shipyard view renders repair, local service cards and the booster row from a fake port', () => {
    const serviceIds = ['cargo', 'engine', 'weaponary'];
    const serviceCards = Object.fromEntries(serviceIds.map(serviceId => [serviceId, new FakeElement({
        '.shipyard-card-icon': new FakeElement(),
        '.shipyard-card-name': new FakeElement(),
        '.shipyard-card-level': new FakeElement(),
        '.shipyard-card-capability': new FakeElement(),
        '.shipyard-card-note': new FakeElement(),
        '.shipyard-card-availability': new FakeElement({ '.shipyard-card-availability-state': new FakeElement(), '.shipyard-card-availability-label': new FakeElement(), '.shipyard-card-availability-planet': new FakeElement() }),
        '.shipyard-card-action': new FakeElement({ '.shipyard-card-action-label': new FakeElement(), '.shipyard-card-action-price': new FakeElement() })
    })]));
    for (const serviceId of serviceIds) serviceCards[serviceId].dataset.serviceId = serviceId;
    const repairCard = new FakeElement({
        '.shipyard-card-name': new FakeElement(),
        '.shipyard-repair-icon': new FakeElement(),
        '.shipyard-repair-hp': new FakeElement(),
        '.shipyard-repair-bar': new FakeElement(),
        '.shipyard-repair-increment': new FakeElement()
    });
    const boosterCard = new FakeElement({
        '.shipyard-card-icon': new FakeElement(),
        '.shipyard-card-name': new FakeElement(),
        '.shipyard-card-effect': new FakeElement(),
        '.shipyard-card-availability': new FakeElement({ '.shipyard-card-availability-state': new FakeElement(), '.shipyard-card-availability-label': new FakeElement(), '.shipyard-card-availability-planet': new FakeElement() }),
        '.shipyard-card-action': new FakeElement({ '.shipyard-card-action-label': new FakeElement(), '.shipyard-card-action-price': new FakeElement() })
    });
    const shipyardView = new FakeElement({
        '.shipyard-repair-card': repairCard,
        '[data-booster-row]': boosterCard,
        '[data-service-id]': serviceIds.map(serviceId => serviceCards[serviceId])
    });
    const clickable = ['#landing-status-commodity-name', '#landing-status-planet-stock', '#landing-status-supply', '#landing-status-production', '#landing-status-consumption', '#landing-status-stock-change', '#landing-status-player-stock', '#landing-status-player-stock-heading', '#landing-status-planet-stock-bar', '#landing-status-player-stock-bar',
        '#landing-status-average-buy-price', '#landing-status-trade-income', '#landing-status-trade-result', '#landing-status-quantity-label',
        '#landing-status-quantity', '#landing-status-quantity-value', '#landing-status-unit-price',
        '#landing-status-confirm', '#landing-status-launch', '#landing-status-market', '#landing-status-shipyard', '#landing-status-market-back',
        '.market-commodity-icon', '#landing-status-market-heading', '#landing-status-market-clock', '#landing-status-market-credits', '#landing-status-market-cargo',
        '#landing-status-title', '.landing-visual', '#landing-status-hub-back', '#landing-status-hub-clock', '#landing-status-hub-credits', '#landing-status-hub-cargo', '#landing-status-hub-time-control',
        '#landing-status-market-time-control', '#landing-status-facilities-time-control', '#landing-status-shipyard-time-control',
        '#landing-status-facilities-heading', '#landing-status-facilities-clock', '#landing-status-facilities-credits', '#landing-status-facilities-cargo', '#landing-status-facilities'];
    const modal = new FakeElement();
    const hub = new FakeElement();
    const marketView = new FakeElement();
    const facilitiesView = new FakeElement();
    const facilitiesBack = new FakeElement();
    const shipyardBack = new FakeElement();
    const shipyardRepairButton = new FakeElement({ '.shipyard-card-action-label': new FakeElement(), '.shipyard-card-action-price': new FakeElement() });
    const shipyardButton = new FakeElement();
    const root = new FakeElement({
        ...Object.fromEntries(clickable.map(selector => [selector, new FakeElement()])),
        '#landing-status': modal,
        '#landing-status-confirm': new FakeElement({ '.market-confirm-label': new FakeElement(), '.market-confirm-price': new FakeElement() }),
        '#landing-status-planet-stock-bar': new FakeElement({
            '.market-stock-segment--low': new FakeElement({ '.market-stock-fill': new FakeElement() }),
            '.market-stock-segment--medium': new FakeElement({ '.market-stock-fill': new FakeElement() }),
            '.market-stock-segment--high': new FakeElement({ '.market-stock-fill': new FakeElement() })
        }),
        '#landing-status-player-stock-bar': new FakeElement({ '.market-stock-fill': new FakeElement() }),
        '#landing-status-hub': hub,
        '#landing-status-market-view': marketView,
        '#landing-status-facilities-view': facilitiesView,
        '#landing-status-facilities-back': facilitiesBack,
        '#landing-status-shipyard-view': shipyardView,
        '#landing-status-shipyard-heading': new FakeElement(),
        '#landing-status-shipyard-planet': new FakeElement(),
        '#landing-status-shipyard-clock': new FakeElement(),
        '#landing-status-shipyard-credits': new FakeElement(),
        '#landing-status-shipyard-cargo': new FakeElement(),
        '#landing-status-shipyard-back': shipyardBack,
        '#landing-status-shipyard-repair': shipyardRepairButton,
        '#landing-status-shipyard': shipyardButton
    });
    const services = [
        { serviceId: 'cargo', label: 'Cargo Capacity', servicePlanetId: 'seroton', servicePlanetName: 'Seroton', level: 1, maximumLevel: 5, price: 15_000, available: true, affordable: true, maximum: false, failure: null, currentCapability: 40, maximumCapability: 110 },
        { serviceId: 'engine', label: 'Engine System', servicePlanetId: 'lactozis-7c', servicePlanetName: 'Lactozis-7C', level: 2, maximumLevel: 5, price: 40_000, available: false, affordable: false, maximum: false, failure: 'wrong-planet', currentCapability: 110, maximumCapability: 150 },
        { serviceId: 'weaponary', label: 'Weapon System', servicePlanetId: 'maslo-prime', servicePlanetName: 'Maslo-Prime', level: 10, maximumLevel: 10, price: 0, available: false, affordable: false, maximum: true, failure: 'wrong-planet', currentCapability: 10, maximumCapability: 10 }
    ];
    const healthBandOf = currentHitPoints => currentHitPoints >= 70 ? 'healthy' : currentHitPoints >= 30 ? 'warning' : 'critical';
    const repairOf = currentHitPoints => ({
        currentHitPoints,
        maximumHitPoints: 100,
        incrementHitPoints: 10,
        price: 1_000,
        failure: currentHitPoints >= 100 ? 'full-health' : null,
        healthBand: healthBandOf(currentHitPoints)
    });
    const shipyardSnapshot = overrides => ({
        visible: true, eligible: true, planetId: 'seroton', planetName: 'Seroton', credits: 1_000_000, cargoUsed: 3, cargoCapacity: 40,
        clock: { remainingSeconds: 754, runState: 'PAUSED', playerPaused: true },
        repair: repairOf(75),
        services, booster: { owned: false, price: 75_000, servicePlanetId: 'lactozis-7c', servicePlanetName: 'Lactozis-7C', available: false, affordable: false, failure: 'wrong-planet' },
        ...overrides
    });
    const commodity = { commodityId: 'milk', stock: 400, stockCapacity: 400, lowerStockThreshold: 100, upperStockThreshold: 300, carriedQuantity: 0, unitPrice: 100, averageBuyPrice: 0, netPerSecond: 0 };
    const marketSnapshot = {
        visible: true, eligible: true, planetId: 'seroton', planetName: 'Seroton', credits: 1_000_000,
        cargoUsed: 3, cargoCapacity: 40, commodities: [commodity], selectedCommodityId: 'milk', tradeQuantity: 0,
        selectedCommodity: commodity, plannedStockDelta: 0, plannedCargoDelta: 0, supplyLevel: 'Medium',
        clock: { remainingSeconds: 754, runState: 'PAUSED', playerPaused: true },
        commodityFlow: { productionPerSecond: 0, consumptionPerSecond: 0, netPerSecond: 0 },
        quote: { quantity: 0, total: 0, failure: null, postTradeStock: 400, nextUnitPrice: 100 }
    };
    const facilitiesSnapshot = { visible: false, eligible: false, planetId: null, planetName: null, credits: 1_000_000, cargoUsed: 3, cargoCapacity: 40, clock: marketSnapshot.clock, facilities: [] };
    let shipyardListener = null;
    const repairs = [];
    const upgrades = [];
    const boosters = [];
    let shipyardUnsubscribes = 0;
    let portDestroyed = 0;
    const port = {
        getSnapshot: () => marketSnapshot,
        subscribe: next => { next(marketSnapshot); return () => {}; },
        getFacilitiesSnapshot: () => facilitiesSnapshot,
        subscribeFacilities: next => { next(facilitiesSnapshot); return () => {}; },
        getShipyardSnapshot: () => shipyardSnapshot({}),
        subscribeShipyard: next => { shipyardListener = next; next(shipyardSnapshot({})); return () => { shipyardUnsubscribes++; }; },
        selectCommodity: () => {},
        setTradeQuantity: () => {},
        confirmTrade: () => {},
        buildFacility: () => {},
        upgradeFacility: () => {},
        downgradeFacility: () => {},
        repairShip: () => repairs.push('repair'),
        upgradeShipService: serviceId => upgrades.push(serviceId),
        purchaseBooster: () => boosters.push('booster'),
        togglePlayerPause: () => {},
        launch: () => {},
        destroy: () => { portDestroyed++; }
    };
    const handle = mountLandingStatus(root, port);
    const textOf = (card, selector) => card.querySelector(selector).textContent;
    const actionOf = card => card.querySelector('.shipyard-card-action');
    const actionLabelOf = card => actionOf(card).querySelector('.shipyard-card-action-label');
    const actionPriceOf = card => actionOf(card).querySelector('.shipyard-card-action-price');

    const shipyardMarkup = readFileSync('index.html', 'utf8');
    assert.match(shipyardMarkup, /<p id="landing-status-shipyard-repair-hp" class="shipyard-repair-hp">/,
        'the repair readout owns the id the health bar points at');
    assert.match(shipyardMarkup, /<progress class="shipyard-repair-bar" value="0" max="100" aria-labelledby="landing-status-shipyard-repair-hp">/,
        'the shipyard health bar takes its accessible name from the Hull readout');
    assert(!shipyardMarkup.includes('shipyard-card-price'), 'the separate Price row is gone');
    assert.equal((shipyardMarkup.match(/<button[^>]*class="shipyard-card-action"[^>]*><span class="shipyard-card-action-label"><\/span><span class="shipyard-card-action-price"><\/span><\/button>/g) ?? []).length, 5,
        'all five shipyard actions stack their label over the coin amount');
    assert.match(shipyardStylesheet, /#landing-status-shipyard-view \.shipyard-card-action:not\(:disabled\) \{ color: var\(--ui-surface\); background: var\(--ui-action-enabled\); \}/,
        'an enabled shipyard button turns green');
    assert.match(shipyardStylesheet, /\.shipyard-card-action-price\[hidden\] \{ display: none; \}/, 'a priceless button hides its coin row');
    assert.match(shipyardStylesheet, /\.shipyard-card-action-price::before \{[^}]*coins_32x32\.png/, 'the amount row shows the cash icon');
    assert.match(shipyardStylesheet, /\.shipyard-card-availability \{ display: flex; flex-direction: column; align-items: center; gap: 1px; color: var\(--ui-health-critical\); font-size: 1\.2em; font-weight: 700; text-align: center; \}/,
        'the unavailability notice is a centred, larger red block');
    assert.equal((shipyardMarkup.match(/<p class="shipyard-card-availability"><span class="shipyard-card-availability-state"><\/span><span class="shipyard-card-availability-label"><\/span><span class="shipyard-card-availability-planet"><\/span><\/p>/g) ?? []).length, 4,
        'every shipyard card splits its notice into state, label and planet lines');
    assert.equal((shipyardMarkup.match(/<p class="shipyard-card-capability"><\/p>/g) ?? []).length, 3, 'every system card states its current capability');
    assert.equal((shipyardMarkup.match(/<p class="shipyard-card-note"><\/p>/g) ?? []).length, 3, 'every system card carries a short note');
    assert(!shipyardMarkup.includes('shipyard-repair-increment'), 'the standalone repair increment row moved onto the button');
    for (const serviceId of shipServiceIconIds) {
        const cardMarker = serviceId === 'booster'
            ? '<article class="shipyard-card shipyard-booster-card" data-booster-row>'
            : `<article class="shipyard-card" data-service-id="${serviceId}">`;
        assert.match(shipyardMarkup, new RegExp(`${cardMarker}\\s*<div class="shipyard-card-header"><span class="shipyard-card-icon" role="img"></span>`),
            `the ${serviceId} card pairs its name with an icon tile`);
    }

    assert.equal(shipyardButton.disabled, false, 'the shipyard control is enabled from the landed hub');
    assert.equal(shipyardButton.attributes['aria-label'], displayLabels.shipyard);
    shipyardButton.click();
    assert.equal(hub.hidden, true);
    assert.equal(shipyardView.hidden, false, 'clicking Shipyard opens the landed shipyard view');
    assert.equal(documentStub.activeElement, shipyardRepairButton, 'an available repair takes focus');

    assert.equal(textOf(repairCard, '.shipyard-card-name'), displayLabels.shipyardRepair);
    assert.equal(textOf(repairCard, '.shipyard-repair-hp'), `${displayLabels.shipyardHull}: 75 / 100`);
    assert.equal(repairCard.querySelector('.shipyard-repair-bar').value, 75);
    assert.equal(repairCard.querySelector('.shipyard-repair-bar').max, 100);
    assert.equal(repairCard.querySelector('.shipyard-repair-bar').dataset.healthBand, 'healthy', 'a healthy hull keeps the bar green');
    shipyardListener(shipyardSnapshot({ repair: repairOf(25) }));
    assert.equal(repairCard.querySelector('.shipyard-repair-bar').value, 25, 'the bar fill follows the current hit points');
    assert.equal(repairCard.querySelector('.shipyard-repair-bar').dataset.healthBand, 'critical', 'a badly damaged hull turns the bar red');
    shipyardListener(shipyardSnapshot({ repair: repairOf(60) }));
    assert.equal(repairCard.querySelector('.shipyard-repair-bar').dataset.healthBand, 'warning', 'healing past 30 turns the bar amber');
    shipyardListener(shipyardSnapshot({ repair: repairOf(85) }));
    assert.equal(repairCard.querySelector('.shipyard-repair-bar').dataset.healthBand, 'healthy', 'healing back over 70 turns the bar green again');
    shipyardListener(shipyardSnapshot({}));
    assert.equal(shipyardRepairButton.querySelector('.shipyard-card-action-label').textContent,
        `${displayLabels.shipyardRepairAction} 10% ${displayLabels.shipyardMaxHitPoints}`,
        'the repair button names the fix and the hull it restores');
    assert.equal(shipyardRepairButton.querySelector('.shipyard-card-action-price').textContent, '1,000', 'the repair price sits on the button');
    assert.equal(shipyardRepairButton.querySelector('.shipyard-card-action-price').hidden, false);
    assert(!shipyardRepairButton.querySelector('.shipyard-card-action-price').textContent.includes('cr'), 'the repair price carries no currency suffix');
    assert.equal(shipyardRepairButton.attributes['aria-label'],
        `${displayLabels.shipyardRepair}: ${displayLabels.shipyardRepairAction} 10% ${displayLabels.shipyardMaxHitPoints} 1,000`);
    assert.equal(shipyardRepairButton.disabled, false);
    assert.equal(root.querySelector('#landing-status-shipyard-credits').textContent, '1,000,000', 'the shipyard balance uses the shared market header format');
    assert.equal(root.querySelector('#landing-status-shipyard-cargo').textContent, '3 / 40');
    const shipyardClockText = root.querySelector('#landing-status-shipyard-clock').textContent;
    assert(shipyardClockText.startsWith('12:34 '), 'the shipyard header shows the run clock');
    assert(shipyardClockText.endsWith(` ${displayLabels.clockPaused}`), 'the shipyard clock shows the paused run state');
    assert.equal(root.querySelector('#landing-status-shipyard-heading').textContent, displayLabels.shipyard);
    assert.equal(root.querySelector('#landing-status-shipyard-back').textContent, displayLabels.facilitiesBackToPlanet);
    assert.equal(root.querySelector('#landing-status-shipyard-planet').textContent, 'Seroton');

    assert.equal(textOf(serviceCards.cargo, '.shipyard-card-name'), 'Cargo Capacity');
    assert.equal(serviceCards.cargo.querySelector('.shipyard-card-icon').attributes['aria-label'], `Cargo Capacity${displayLabels.shipServiceIconSuffix}`,
        'each service name is paired with its own placeholder icon');
    assert.equal(textOf(serviceCards.cargo, '.shipyard-card-level'), `${displayLabels.facilityLevel} 1 / 5`);
    assert.equal(textOf(serviceCards.cargo, '.shipyard-card-capability'), `${displayLabels.shipyardCapabilityCargo} 40 ${displayLabels.shipyardCapabilityUnits}`,
        'the cargo card states the current hold');
    assert.equal(textOf(serviceCards.cargo, '.shipyard-card-note'), displayLabels.shipyardNoteCargo);
    assert.equal(textOf(serviceCards.engine, '.shipyard-card-capability'), `${displayLabels.shipyardCapabilityEngine} 110${displayLabels.shipyardCapabilityPercent}`);
    assert.equal(textOf(serviceCards.weaponary, '.shipyard-card-capability'), `${displayLabels.shipyardCapabilityWeaponary} 10 ${displayLabels.shipyardCapabilityProjectiles}`,
        'a multi-shot volley reads in the plural');
    assert.equal(actionLabelOf(serviceCards.cargo).textContent, displayLabels.facilityUpgrade);
    assert.equal(actionPriceOf(serviceCards.cargo).textContent, '15,000', 'the upgrade price moved onto the button');
    assert.equal(actionPriceOf(serviceCards.cargo).hidden, false);
    assert(!actionPriceOf(serviceCards.cargo).textContent.includes('cr'), 'a shipyard price carries no currency suffix');
    assert.equal(textOf(serviceCards.cargo, '.shipyard-card-availability'), '');
    assert.equal(serviceCards.cargo.querySelector('.shipyard-card-availability').hidden, true);
    assert.equal(actionOf(serviceCards.cargo).disabled, false);
    assert.equal(actionOf(serviceCards.cargo).hidden, false, 'an actionable upgrade keeps its button');
    assert.equal(actionOf(serviceCards.cargo).attributes['aria-label'], `Cargo Capacity: ${displayLabels.facilityUpgrade} 15,000`);

    const availabilityOf = card => card.querySelector('.shipyard-card-availability');
    assert.equal(availabilityOf(serviceCards.engine).querySelector('.shipyard-card-availability-state').textContent, `${displayLabels.shipyardNotAvailable}.`);
    assert.equal(availabilityOf(serviceCards.engine).querySelector('.shipyard-card-availability-label').textContent, `${displayLabels.shipyardServicePlanet}:`);
    assert.equal(availabilityOf(serviceCards.engine).querySelector('.shipyard-card-availability-planet').textContent, 'Lactozis-7C');
    assert.equal(availabilityOf(serviceCards.engine).hidden, false);
    assert.equal(actionLabelOf(serviceCards.engine).textContent, displayLabels.shipyardNotAvailable);
    assert.equal(actionOf(serviceCards.engine).disabled, true, 'an off-planet service is disabled');
    assert.equal(actionOf(serviceCards.engine).hidden, true, 'a Not available button is hidden instead of shown disabled');
    assert.equal(actionLabelOf(serviceCards.weaponary).textContent, displayLabels.facilityMaxLevel);
    assert.equal(actionOf(serviceCards.weaponary).disabled, true, 'a maximum-level service is disabled');
    assert.equal(actionOf(serviceCards.weaponary).hidden, false, 'a maximum-level service keeps its MAX LEVEL button');
    assert.equal(actionPriceOf(serviceCards.weaponary).textContent, '', 'a maximum-level service shows no price');
    assert.equal(actionPriceOf(serviceCards.weaponary).hidden, true);

    assert.equal(textOf(boosterCard, '.shipyard-card-name'), displayLabels.shipyardBooster);
    assert.equal(boosterCard.querySelector('.shipyard-card-icon').attributes['aria-label'], `${displayLabels.shipyardBooster}${displayLabels.shipServiceIconSuffix}`,
        'the booster row carries its own placeholder icon');
    assert.equal(textOf(boosterCard, '.shipyard-card-effect'), displayLabels.shipyardBoosterEffect);
    assert.equal(actionLabelOf(boosterCard).textContent, displayLabels.shipyardNotAvailable);
    assert.equal(actionPriceOf(boosterCard).textContent, '75,000', 'the booster price sits on its button');
    assert.equal(availabilityOf(boosterCard).querySelector('.shipyard-card-availability-state').textContent, `${displayLabels.shipyardNotAvailable}.`);
    assert.equal(availabilityOf(boosterCard).querySelector('.shipyard-card-availability-label').textContent, `${displayLabels.shipyardServicePlanet}:`);
    assert.equal(availabilityOf(boosterCard).querySelector('.shipyard-card-availability-planet').textContent, 'Lactozis-7C');
    assert.equal(actionOf(boosterCard).disabled, true);
    assert.equal(actionOf(boosterCard).hidden, true, 'an off-planet booster button is hidden too');

    actionOf(serviceCards.cargo).click();
    shipyardRepairButton.click();
    actionOf(boosterCard).click();
    assert.deepEqual(upgrades, ['cargo']);
    assert.deepEqual(repairs, ['repair']);
    assert.deepEqual(boosters, ['booster']);

    shipyardListener(shipyardSnapshot({
        credits: 0,
        repair: repairOf(100),
        services: [
            { ...services[0], price: 120_000, available: true, affordable: false, failure: 'insufficient-credits' },
            { serviceId: 'engine', label: 'Engine System', servicePlanetId: 'lactozis-7c', servicePlanetName: 'Lactozis-7C', level: 1, maximumLevel: 5, price: 20_000, available: true, affordable: false, maximum: false, failure: 'insufficient-credits' },
            services[2]
        ],
        booster: { owned: true, price: 75_000, servicePlanetId: 'lactozis-7c', servicePlanetName: 'Lactozis-7C', available: false, affordable: false, failure: 'already-owned' }
    }));
    assert.equal(textOf(repairCard, '.shipyard-repair-hp'), `${displayLabels.shipyardHull}: 100 / 100`, 'the repair readout refreshes immediately');
    assert.equal(shipyardRepairButton.disabled, true, 'a full hull disables repair');
    assert.equal(actionOf(serviceCards.cargo).disabled, true, 'an unaffordable upgrade is disabled');
    assert.equal(availabilityOf(serviceCards.engine).hidden, true, 'the local path becomes available on its own planet');
    assert.equal(availabilityOf(serviceCards.engine).querySelector('.shipyard-card-availability-state').textContent, '');
    assert.equal(actionOf(serviceCards.engine).disabled, true, 'the local path stays disabled while unaffordable');
    assert.equal(actionOf(serviceCards.engine).hidden, false, 'an unaffordable local upgrade still shows its disabled button');
    assert.equal(actionLabelOf(boosterCard).textContent, displayLabels.shipyardOwned);
    assert.equal(actionOf(boosterCard).disabled, true, 'an owned booster cannot be bought again');
    assert.equal(actionOf(boosterCard).hidden, false, 'an owned booster keeps its Owned row');
    assert.equal(actionPriceOf(boosterCard).hidden, true, 'an owned booster shows no price');
    assert.equal(availabilityOf(boosterCard).querySelector('.shipyard-card-availability-state').textContent, displayLabels.shipyardOwned);
    assert.equal(availabilityOf(boosterCard).querySelector('.shipyard-card-availability-planet').textContent, '');

    shipyardButton.click();
    assert.equal(documentStub.activeElement, shipyardBack, 'an unavailable repair moves focus to the always-enabled Back control');
    shipyardBack.click();
    assert.equal(shipyardView.hidden, true, 'Back returns to the hub without launching');
    assert.equal(hub.hidden, false);
    assert.equal(documentStub.activeElement, shipyardButton, 'returning from the shipyard refocuses its hub control');

    handle.destroy();
    handle.destroy();
    assert.equal(shipyardUnsubscribes, 1, 'teardown unsubscribes the shipyard listener exactly once');
    assert.equal(portDestroyed, 1);
    assert.equal(shipyardButton.listeners.size, 0);
    assert.equal(shipyardBack.listeners.size, 0);
    assert.equal(shipyardRepairButton.listeners.size, 0);
    for (const serviceId of serviceIds) assert.equal(actionOf(serviceCards[serviceId]).listeners.size, 0);
    assert.equal(actionOf(boosterCard).listeners.size, 0);
});
