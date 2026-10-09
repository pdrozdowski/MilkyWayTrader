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
const { mountLandingStatus } = transpileModule('src/ui/components/landingStatus.ts', { './displayLabels': { displayLabels }, './formatCredits': { formatCredits } });

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

test('facilities view renders five cards with levels, states, recipes and actions from a fake port', () => {
    const selectors = [
        '#landing-status-commodity-name', '#landing-status-planet-stock', '#landing-status-supply', '#landing-status-production', '#landing-status-consumption', '#landing-status-stock-change', '#landing-status-player-stock',
        '#landing-status-average-buy-price', '#landing-status-trade-income', '#landing-status-trade-result', '#landing-status-quantity-label',
        '#landing-status-quantity', '#landing-status-quantity-value', '#landing-status-unit-price', '#landing-status-budget',
        '#landing-status-confirm', '#landing-status-launch', '#landing-status-market', '#landing-status-shipyard', '#landing-status-market-back',
        '.market-commodity-icon', '#landing-status-market-heading', '#landing-status-market-clock', '#landing-status-market-credits', '#landing-status-market-cargo',
        '#landing-status-title', '.landing-visual'
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
        '.facility-card-price': new FakeElement(),
        '.facility-card-action': new FakeElement()
    })]));
    const modal = new FakeElement();
    const hub = new FakeElement();
    const marketView = new FakeElement();
    const facilitiesView = new FakeElement(Object.fromEntries(facilityIdList.map(facilityId => [`[data-facility-id="${facilityId}"]`, cards[facilityId]])));
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
        '#landing-status-hub': hub,
        '#landing-status-market-view': marketView,
        '#landing-status-facilities-view': facilitiesView,
        '#landing-status-facilities-heading': facilitiesHeading,
        '#landing-status-facilities-back': facilitiesBack,
        '#landing-status-facilities-clock': facilitiesClock,
        '#landing-status-facilities-credits': facilitiesCredits,
        '#landing-status-facilities-cargo': facilitiesCargo,
        '#landing-status-facilities': facilitiesButton,
        '#landing-status-catalogue > button[data-commodity-id]': [catalogueButton]
    });
    const row = (facilityId, label, level, status, outputCommodityId, outputPerCycle, inputsPerCycle, modifier, action) =>
        ({ facilityId, label, level, maxLevel: 3, status, outputCommodityId, outputPerCycle, inputsPerCycle, modifier, action });
    const noModifier = { upgradePriceMultiplier: 1, outputMultiplier: 1 };
    const baseFacilities = [
    row('dairyFarm', 'Dairy Farm', 1, 'working', 'milk', 10, [], noModifier, { kind: 'upgrade', targetLevel: 2, price: 25_000, affordable: true }),
    row('grainFarm', 'Grain Farm', 1, 'insufficientResources', 'grain', 10, [], noModifier, { kind: 'upgrade', targetLevel: 2, price: 25_000, affordable: true }),
    row('cheeseFactory', 'Cheese Factory', 1, 'working', 'cheese', 6, [{ commodityId: 'milk', quantity: 12 }], { upgradePriceMultiplier: 0.8, outputMultiplier: 1.2 }, { kind: 'upgrade', targetLevel: 2, price: 28_000, affordable: true }),
    row('bakery', 'Bakery', 0, 'notBuilt', 'bun', 0, [], noModifier, { kind: 'build', targetLevel: 1, price: 35_000, affordable: true }),
    row('foodProcessor', 'Food Processor', 3, 'working', 'spaceRation', 20, [{ commodityId: 'cheese', quantity: 40 }], noModifier, { kind: 'max', targetLevel: 3, price: 0, affordable: true })
    ];
    const facilitiesSnapshot = credits => ({
        visible: true, eligible: true, planetId: 'seroton', planetName: 'Seroton',
        credits, cargoUsed: 3, cargoCapacity: 20,
        clock: { remainingSeconds: 754, runState: 'PAUSED' },
        facilities: baseFacilities.map(facility => ({ ...facility, action: { ...facility.action, affordable: facility.action.kind === 'max' || facility.action.price <= credits } }))
    });
    const commodity = { commodityId: 'milk', stock: 400, carriedQuantity: 0, unitPrice: 100, averageBuyPrice: 0 };
    const marketSnapshot = {
        visible: true, eligible: true, planetId: 'seroton', planetName: 'Seroton', credits: 1_000_000,
        cargoUsed: 3, cargoCapacity: 20, commodities: [commodity], selectedCommodityId: 'milk', tradeQuantity: 0,
        selectedCommodity: commodity, plannedStockDelta: 0, plannedCargoDelta: 0, supplyLevel: 'Medium',
        clock: { remainingSeconds: 754, runState: 'PAUSED' },
        commodityFlow: { productionPerSecond: 10, consumptionPerSecond: 12, netPerSecond: -2 },
        quote: { quantity: 0, total: 0, failure: null, postTradeStock: 400, nextUnitPrice: 100 }
    };
    let marketListener = null;
    let facilitiesListener = null;
    let marketUnsubscribes = 0;
    let facilitiesUnsubscribes = 0;
    let portDestroyed = 0;
    const builds = [];
    const upgrades = [];
    const port = {
        getSnapshot: () => marketSnapshot,
        subscribe: next => { marketListener = next; next(marketSnapshot); return () => { marketUnsubscribes++; }; },
        getFacilitiesSnapshot: () => facilitiesSnapshot(1_000_000),
        subscribeFacilities: next => { facilitiesListener = next; next(facilitiesSnapshot(1_000_000)); return () => { facilitiesUnsubscribes++; }; },
        selectCommodity: () => {},
        setTradeQuantity: () => {},
        confirmTrade: () => {},
        buildFacility: facilityId => builds.push(facilityId),
        upgradeFacility: facilityId => upgrades.push(facilityId),
        launch: () => {},
        destroy: () => { portDestroyed++; }
    };
    const handle = mountLandingStatus(root, port);
    const element = selector => root.querySelector(selector);
    assert.equal(element('#landing-status-supply').textContent, `${displayLabels.supply}: Medium`);
    assert.equal(element('#landing-status-supply').dataset.supplyLevel, 'Medium');
    marketListener({ ...marketSnapshot, supplyLevel: 'Low' });
    assert.equal(element('#landing-status-supply').dataset.supplyLevel, 'Low');
    marketListener({ ...marketSnapshot, supplyLevel: 'High' });
    assert.equal(element('#landing-status-supply').dataset.supplyLevel, 'High');
    marketListener(marketSnapshot);
    assert.equal(element('#landing-status-production').textContent, `${displayLabels.marketProduction}: 10 ${displayLabels.commodityLabels.milk} ${displayLabels.facilityPerCycle}`);
    assert.equal(element('#landing-status-consumption').textContent, `${displayLabels.marketConsumption}: 12 ${displayLabels.commodityLabels.milk} ${displayLabels.facilityPerCycle}`);
    assert.equal(element('#landing-status-stock-change').textContent, `${displayLabels.marketStockChange}: -2 ${displayLabels.commodityLabels.milk} ${displayLabels.facilityPerCycle}`);
    assert(element('#landing-status-stock-change').classList.values.has('market-stock-delta--negative'), 'a net decrease is flagged negative');
    assert(!element('#landing-status-stock-change').classList.values.has('market-stock-delta--positive'), 'a net decrease is not flagged positive');
    assert.equal(element('#landing-status-market-credits').textContent, (1_000_000).toLocaleString('en-US'));
    assert.equal(element('#landing-status-market-cargo').textContent, '3 / 20');
    assert.equal(element('.market-commodity-icon').dataset.commodityId, marketSnapshot.selectedCommodityId);
    assert.equal(element('.market-commodity-icon').textContent, '');
    assert.equal(catalogueName.textContent, displayLabels.commodityLabels.milk, 'a catalogue button shows the commodity label in its name span');
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
    const price = facilityId => cards[facilityId].querySelector('.facility-card-price');
    const action = facilityId => cards[facilityId].querySelector('.facility-card-action');
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
    assert.equal(status('bakery').textContent, displayLabels.facilityStatusLabels.notBuilt);
    assert.equal(textOf(output('dairyFarm')), `${displayLabels.facilityProduces}: 10 ${displayLabels.commodityLabels.milk} ${displayLabels.facilityPerCycle}`);
    assert.equal(inputs('dairyFarm').textContent, displayLabels.facilityNoInputs);
    const iconIds = element => (element.replacedChildren ?? []).filter(child => child.className.includes('facility-card-commodity-icon')).map(child => child.dataset.commodityId);
    assert.deepEqual(iconIds(output('dairyFarm')), ['milk'], 'the produced commodity renders a small commodity icon');
    assert.deepEqual(iconIds(inputs('cheeseFactory')), ['milk'], 'the consumed commodity renders a small commodity icon');
    assert.equal(textOf(inputs('cheeseFactory')), `${displayLabels.facilityConsumes}: 12 ${displayLabels.commodityLabels.milk} ${displayLabels.facilityPerCycle}`);
    assert.equal(modifier('dairyFarm').textContent, '');
    assert.equal(modifier('dairyFarm').hidden, true);
    assert.equal(modifier('cheeseFactory').textContent, `${displayLabels.facilityOutputBonus} +20% · ${displayLabels.facilityUpgradeDiscount} 20%`);
    assert.equal(modifier('cheeseFactory').hidden, false);
    assert.equal(action('bakery').textContent, displayLabels.facilityBuild);
    assert.equal(action('bakery').dataset.action, 'build');
    assert.equal(action('bakery').attributes['aria-label'], `Bakery: ${displayLabels.facilityBuild}`);
    assert.equal(action('dairyFarm').textContent, displayLabels.facilityUpgrade);
    assert.equal(action('dairyFarm').dataset.action, 'upgrade');
    assert.equal(action('dairyFarm').attributes['aria-label'], `Dairy Farm: ${displayLabels.facilityUpgrade}`);
    assert.equal(action('foodProcessor').textContent, displayLabels.facilityMaxLevel);
    assert.equal(action('foodProcessor').dataset.action, 'max');
    assert.equal(action('foodProcessor').attributes['aria-label'], `Food Processor: ${displayLabels.facilityMaxLevel}`);
    assert.equal(action('foodProcessor').disabled, false);
    assert.equal(price('bakery').textContent, `${displayLabels.facilityPrice}: ${(35_000).toLocaleString('en-US')}`);
    assert.equal(price('foodProcessor').textContent, '');
    assert.equal(facilitiesBack.textContent, displayLabels.facilitiesBackToPlanet);
    assert.equal(facilitiesBack.attributes['aria-label'], displayLabels.facilitiesBackToPlanet);
    assert.equal(facilitiesHeading.textContent, displayLabels.facilities);
    assert.equal(facilitiesClock.textContent, `12:34 · ${displayLabels.clockPaused}`);
    assert.equal(facilitiesClock.attributes['aria-label'], `12:34 · ${displayLabels.clockPaused}`);
    assert.equal(facilitiesCredits.textContent, `${displayLabels.marketCredits}: ${(1_000_000).toLocaleString('en-US')}`);
    assert.equal(facilitiesCargo.textContent, `${displayLabels.marketCargo}: 3 / 20`);
    assert.equal(cards['dairyFarm'].querySelector('.facility-card-icon').textContent, '');
    assert.equal(cards['dairyFarm'].querySelector('.facility-card-icon').attributes['aria-label'], `${displayLabels.commodityLabels.milk}${displayLabels.commodityIconSuffix}`);

    action('bakery').click();
    action('dairyFarm').click();
    action('foodProcessor').click();
    assert.deepEqual(builds, ['bakery']);
    assert.deepEqual(upgrades, ['dairyFarm']);

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
    assert.equal(marketUnsubscribes, 1, 'teardown unsubscribes the market listener exactly once');
    assert.equal(facilitiesUnsubscribes, 1, 'teardown unsubscribes the facilities listener exactly once');
    assert.equal(portDestroyed, 1, 'teardown destroys the port exactly once');
    for (const facilityId of facilityIdList) assert.equal(action(facilityId).listeners.size, 0);
    assert.equal(facilitiesButton.listeners.size, 0);
    assert.equal(facilitiesBack.listeners.size, 0);
});
