import type {
    LandingCommodityId, LandingFacilityId, LandingShipServiceId, LandedFacilitiesSnapshot, LandedShipyardSnapshot,
    LandingStatusSnapshot, LandingStatusPort, UiHandle
} from '../contracts';
import { displayLabels } from './displayLabels';
import { formatCredits } from './formatCredits';

function required<T extends Element> (root: HTMLElement, selector: string): T
{
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing landing status control: ${selector}`);
    return element;
}

const commodityLabels: Readonly<Record<LandingCommodityId, string>> = { milk: displayLabels.milk, grain: displayLabels.grain, cheese: displayLabels.cheese, bun: displayLabels.bun, spaceRation: displayLabels.spaceRation };
const planetTitleAssetById: Readonly<Record<string, string>> = {
    'lactozis-7c': '/assets/banner_lactozis7c.png',
    seroton: '/assets/banner_seroton.png',
    'maslo-prime': '/assets/banner_mlekoprime.png'
};
const planetBackgroundAssetById: Readonly<Record<string, string>> = {
    'lactozis-7c': '/assets/landing_bg_lactozis7c.png',
    seroton: '/assets/landing_bg_seroton.png',
    'maslo-prime': '/assets/landing_bg_masloprime.png'
};
const modifierText = (modifier: Readonly<{ upgradePriceMultiplier: number; outputMultiplier: number }>): string => {
    const parts: string[] = [];
    if (modifier.outputMultiplier !== 1) parts.push(`${displayLabels.facilityOutputBonus} +${Math.round((modifier.outputMultiplier - 1) * 100)}%`);
    if (modifier.upgradePriceMultiplier !== 1) parts.push(`${displayLabels.facilityUpgradeDiscount} ${Math.round((1 - modifier.upgradePriceMultiplier) * 100)}%`);
    return parts.join(' · ');
};

export function mountLandingStatus (root: HTMLElement, port: LandingStatusPort): UiHandle
{
    const modal = required<HTMLElement>(root, '#landing-status');
    const hub = required<HTMLElement>(root, '#landing-status-hub');
    const landingVisual = required<HTMLElement>(root, '.landing-visual');
    const marketView = required<HTMLElement>(root, '#landing-status-market-view');
    const facilitiesView = required<HTMLElement>(root, '#landing-status-facilities-view');
    const shipyardView = required<HTMLElement>(root, '#landing-status-shipyard-view');
    const facilitiesHeading = required<HTMLElement>(root, '#landing-status-facilities-heading');
    const facilitiesBack = required<HTMLButtonElement>(root, '#landing-status-facilities-back');
    const facilitiesClock = required<HTMLElement>(root, '#landing-status-facilities-clock');
    const facilitiesCredits = required<HTMLElement>(root, '#landing-status-facilities-credits');
    const facilitiesCargo = required<HTMLElement>(root, '#landing-status-facilities-cargo');
    const shipyardHeading = required<HTMLElement>(root, '#landing-status-shipyard-heading');
    const shipyardPlanet = required<HTMLElement>(root, '#landing-status-shipyard-planet');
    const shipyardBack = required<HTMLButtonElement>(root, '#landing-status-shipyard-back');
    const shipyardClock = required<HTMLElement>(root, '#landing-status-shipyard-clock');
    const shipyardCredits = required<HTMLElement>(root, '#landing-status-shipyard-credits');
    const shipyardCargo = required<HTMLElement>(root, '#landing-status-shipyard-cargo');
    const shipyardRepairButton = required<HTMLButtonElement>(root, '#landing-status-shipyard-repair');
    const shipyardRepairCard = required<HTMLElement>(shipyardView, '.shipyard-repair-card');
    const shipyardBoosterCard = required<HTMLElement>(shipyardView, '[data-booster-row]');
    const shipyardCards = Array.from(shipyardView.querySelectorAll<HTMLElement>('[data-service-id]'));
    const title = required<HTMLElement>(root, '#landing-status-title');
    const landedBadge = root.querySelector<HTMLImageElement>('#landing-status-landed');
    const marketHeading = required<HTMLElement>(root, '#landing-status-market-heading');
    const marketBack = required<HTMLButtonElement>(root, '#landing-status-market-back');
    const marketClock = required<HTMLElement>(root, '#landing-status-market-clock');
    const marketCredits = required<HTMLElement>(root, '#landing-status-market-credits');
    const marketCargo = required<HTMLElement>(root, '#landing-status-market-cargo');
    const commodityName = required<HTMLElement>(root, '#landing-status-commodity-name');
    const planetStock = required<HTMLElement>(root, '#landing-status-planet-stock');
    const supply = required<HTMLElement>(root, '#landing-status-supply');
    const production = required<HTMLElement>(root, '#landing-status-production');
    const consumption = required<HTMLElement>(root, '#landing-status-consumption');
    const stockChange = required<HTMLElement>(root, '#landing-status-stock-change');
    const playerStock = required<HTMLElement>(root, '#landing-status-player-stock');
    const averageBuyPrice = required<HTMLElement>(root, '#landing-status-average-buy-price');
    const tradeIncome = required<HTMLElement>(root, '#landing-status-trade-income');
    const tradeResult = required<HTMLElement>(root, '#landing-status-trade-result');
    const quantityLabel = required<HTMLElement>(root, '#landing-status-quantity-label');
    const quantity = required<HTMLInputElement>(root, '#landing-status-quantity');
    const quantityValue = required<HTMLOutputElement>(root, '#landing-status-quantity-value');
    const unitPrice = required<HTMLElement>(root, '#landing-status-unit-price');
    const budget = required<HTMLElement>(root, '#landing-status-budget');
    const confirm = required<HTMLButtonElement>(root, '#landing-status-confirm');
    const launch = required<HTMLButtonElement>(root, '#landing-status-launch');
    const market = required<HTMLButtonElement>(root, '#landing-status-market');
    const facilities = required<HTMLButtonElement>(root, '#landing-status-facilities');
    const shipyard = required<HTMLButtonElement>(root, '#landing-status-shipyard');
    const commodityIcon = required<HTMLElement>(root, '.market-commodity-icon');
    const catalogue = Array.from(root.querySelectorAll<HTMLButtonElement>('#landing-status-catalogue > button[data-commodity-id]'));
    let wasVisible = false;
    let view: 'hub' | 'market' | 'facilities' | 'shipyard' = 'hub';
    let landedBadgeFrame = 0;
    const updateLandedBadge = (): void => {
        landedBadgeFrame = landedBadgeFrame === 0 ? 1 : 0;
        if (landedBadge) landedBadge.src = `/assets/banner_landed_0${landedBadgeFrame + 1}.png`;
    };
    const landedBadgeTimer = window.setInterval(updateLandedBadge, 500);
    const focusable = (): HTMLElement[] => Array.from(modal.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])'))
        .filter(element => !element.closest('[hidden]'));
    const facilityActionButtons = new Map<LandingFacilityId, HTMLButtonElement>();
    const chooseFacilityInvestment = (event: Event): void => {
        const button = event.currentTarget as HTMLButtonElement;
        const facilityId = button.dataset.facilityId as LandingFacilityId | undefined;
        if (!facilityId) return;
        if (button.dataset.action === 'build') port.buildFacility(facilityId);
        else if (button.dataset.action === 'upgrade') port.upgradeFacility(facilityId);
    };
    const formatClock = (remainingSeconds: number): string => `${String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:${String(Math.floor(remainingSeconds % 60)).padStart(2, '0')}`;
    const clockText = (clock: Readonly<{ remainingSeconds: number; runState: string }>): string => `${formatClock(clock.remainingSeconds)} · ${clock.runState === 'PAUSED' ? displayLabels.clockPaused : displayLabels.clockRunning}`;
    const recipePart = (commodityId: LandingCommodityId, quantity: number): readonly HTMLElement[] => {
        const icon = document.createElement('span');
        icon.className = 'commodity-icon facility-card-commodity-icon';
        icon.dataset.commodityId = commodityId;
        icon.setAttribute('aria-hidden', 'true');
        const amount = document.createElement('span');
        amount.className = 'facility-card-commodity-amount';
        amount.textContent = `${quantity} ${commodityLabels[commodityId]}`;
        return [icon, amount];
    };
    const renderRecipe = (element: HTMLElement, lead: string, parts: readonly Readonly<{ commodityId: LandingCommodityId; quantity: number }>[]): void => {
        if (parts.length === 0) { element.replaceChildren(); element.textContent = displayLabels.facilityNoInputs; return; }
        const nodes: HTMLElement[] = [];
        const leadNode = document.createElement('span');
        leadNode.className = 'facility-card-recipe-lead';
        leadNode.textContent = `${lead}: `;
        nodes.push(leadNode);
        parts.forEach((part, index) => {
            if (index > 0) {
                const separator = document.createElement('span');
                separator.className = 'facility-card-recipe-separator';
                separator.textContent = ' + ';
                nodes.push(separator);
            }
            nodes.push(...recipePart(part.commodityId, part.quantity));
        });
        const suffix = document.createElement('span');
        suffix.className = 'facility-card-recipe-suffix';
        suffix.textContent = ` ${displayLabels.facilityPerCycle}`;
        nodes.push(suffix);
        element.replaceChildren(...nodes);
    };
    const renderFacilities = (snapshot: Readonly<LandedFacilitiesSnapshot>): void => {
        facilitiesHeading.textContent = displayLabels.facilities;
        facilitiesBack.textContent = displayLabels.facilitiesBackToPlanet;
        facilitiesBack.setAttribute('aria-label', displayLabels.facilitiesBackToPlanet);
        facilitiesClock.textContent = clockText(snapshot.clock);
        facilitiesClock.setAttribute('aria-label', facilitiesClock.textContent);
        facilitiesCredits.textContent = `${displayLabels.marketCredits}: ${formatCredits(snapshot.credits)}`;
        facilitiesCargo.textContent = `${displayLabels.marketCargo}: ${snapshot.cargoUsed} / ${snapshot.cargoCapacity}`;
        facilitiesView.style.backgroundImage = `url('${planetBackgroundAssetById[snapshot.planetId ?? ''] ?? '/assets/landing_bg_seroton.png'}')`;
        for (const row of snapshot.facilities) {
            const card = facilitiesView.querySelector<HTMLElement>(`[data-facility-id="${row.facilityId}"]`);
            if (!card) throw new Error(`Missing facility card: ${row.facilityId}`);
            required<HTMLElement>(card, '.facility-card-name').textContent = row.label;
            required<HTMLElement>(card, '.facility-card-level').textContent = `${displayLabels.facilityLevel} ${row.level} / ${row.maxLevel}`;
            const status = required<HTMLElement>(card, '.facility-card-status');
            status.textContent = displayLabels.facilityStatusLabels[row.status];
            status.dataset.status = row.status;
            const icon = required<HTMLElement>(card, '.facility-card-icon');
            icon.setAttribute('aria-label', `${commodityLabels[row.outputCommodityId]}${displayLabels.commodityIconSuffix}`);
            const outputElement = required<HTMLElement>(card, '.facility-card-output');
            if (row.level > 0) renderRecipe(outputElement, displayLabels.facilityProduces, [{ commodityId: row.outputCommodityId, quantity: row.outputPerCycle }]);
            else { outputElement.replaceChildren(); outputElement.textContent = ''; }
            const inputsElement = required<HTMLElement>(card, '.facility-card-inputs');
            if (row.level > 0) renderRecipe(inputsElement, displayLabels.facilityConsumes, row.inputsPerCycle);
            else { inputsElement.replaceChildren(); inputsElement.textContent = ''; }
            const modifierElement = required<HTMLElement>(card, '.facility-card-modifier');
            modifierElement.textContent = modifierText(row.modifier);
            modifierElement.hidden = modifierElement.textContent === '';
            required<HTMLElement>(card, '.facility-card-price').textContent = row.action.kind === 'max' ? '' : `${displayLabels.facilityPrice}: ${formatCredits(row.action.price)}`;
            const actionButton = required<HTMLButtonElement>(card, '.facility-card-action');
            actionButton.dataset.action = row.action.kind;
            actionButton.disabled = row.action.kind !== 'max' && !row.action.affordable;
            const actionText = row.action.kind === 'build' ? displayLabels.facilityBuild : row.action.kind === 'upgrade' ? displayLabels.facilityUpgrade : displayLabels.facilityMaxLevel;
            actionButton.textContent = actionText;
            actionButton.setAttribute('aria-label', `${row.label}: ${actionText}`);
            if (!facilityActionButtons.has(row.facilityId)) {
                actionButton.dataset.facilityId = row.facilityId;
                actionButton.addEventListener('click', chooseFacilityInvestment);
                facilityActionButtons.set(row.facilityId, actionButton);
            }
        }
    };
    const renderShipyard = (snapshot: Readonly<LandedShipyardSnapshot>): void => {
        shipyardHeading.textContent = displayLabels.shipyard;
        shipyardBack.textContent = displayLabels.facilitiesBackToPlanet;
        shipyardBack.setAttribute('aria-label', displayLabels.facilitiesBackToPlanet);
        shipyardClock.textContent = clockText(snapshot.clock);
        shipyardClock.setAttribute('aria-label', shipyardClock.textContent);
        shipyardCredits.textContent = `${displayLabels.marketCredits}: ${formatCredits(snapshot.credits)}`;
        shipyardCargo.textContent = `${displayLabels.marketCargo}: ${snapshot.cargoUsed} / ${snapshot.cargoCapacity}`;
        shipyardPlanet.textContent = snapshot.planetName ?? '';
        shipyardView.style.backgroundImage = `url('${planetBackgroundAssetById[snapshot.planetId ?? ''] ?? '/assets/landing_bg_seroton.png'}')`;

        required<HTMLElement>(shipyardRepairCard, '.shipyard-card-name').textContent = displayLabels.shipyardRepair;
        const repairIcon = required<HTMLElement>(shipyardRepairCard, '.shipyard-repair-icon');
        repairIcon.setAttribute('aria-label', displayLabels.shipyardRepairIcon);
        required<HTMLElement>(shipyardRepairCard, '.shipyard-repair-hp').textContent =
            `${displayLabels.shipyardHull}: ${snapshot.repair.currentHitPoints} / ${snapshot.repair.maximumHitPoints}`;
        const repairBar = required<HTMLProgressElement>(shipyardRepairCard, '.shipyard-repair-bar');
        repairBar.max = snapshot.repair.maximumHitPoints;
        repairBar.value = snapshot.repair.currentHitPoints;
        const repairIncrement = Math.round(snapshot.repair.incrementHitPoints / snapshot.repair.maximumHitPoints * 100);
        required<HTMLElement>(shipyardRepairCard, '.shipyard-repair-increment').textContent = `+${repairIncrement}% ${displayLabels.shipyardMaxHitPoints}`;
        shipyardRepairButton.textContent = `${displayLabels.shipyardRepairAction} ${formatCredits(snapshot.repair.price)}`;
        shipyardRepairButton.setAttribute('aria-label', shipyardRepairButton.textContent);
        shipyardRepairButton.disabled = snapshot.repair.failure !== null;

        for (const card of shipyardCards) {
            const serviceId = card.dataset.serviceId as LandingShipServiceId;
            const row = snapshot.services.find(candidate => candidate.serviceId === serviceId);
            if (!row) throw new Error(`Missing ship-service row: ${serviceId}`);
            required<HTMLElement>(card, '.shipyard-card-name').textContent = row.label;
            required<HTMLElement>(card, '.shipyard-card-level').textContent = `${displayLabels.facilityLevel} ${row.level} / ${row.maximumLevel}`;
            required<HTMLElement>(card, '.shipyard-card-price').textContent = row.maximum ? '' : `${displayLabels.facilityPrice}: ${formatCredits(row.price)}`;
            const availability = required<HTMLElement>(card, '.shipyard-card-availability');
            availability.textContent = row.available
                ? ''
                : `${displayLabels.shipyardNotAvailable} - ${displayLabels.shipyardServicePlanet}: ${row.servicePlanetName}`;
            availability.hidden = availability.textContent === '';
            const actionButton = required<HTMLButtonElement>(card, '.shipyard-card-action');
            actionButton.dataset.serviceId = row.serviceId;
            actionButton.textContent = row.maximum
                ? displayLabels.facilityMaxLevel
                : row.available ? displayLabels.facilityUpgrade : displayLabels.shipyardNotAvailable;
            actionButton.setAttribute('aria-label', `${row.label}: ${actionButton.textContent}`);
            actionButton.disabled = !row.available || !row.affordable;
        }

        required<HTMLElement>(shipyardBoosterCard, '.shipyard-card-name').textContent = displayLabels.shipyardBooster;
        required<HTMLElement>(shipyardBoosterCard, '.shipyard-card-effect').textContent = displayLabels.shipyardBoosterEffect;
        required<HTMLElement>(shipyardBoosterCard, '.shipyard-card-price').textContent =
            `${displayLabels.facilityPrice}: ${formatCredits(snapshot.booster.price)}`;
        const boosterAvailability = required<HTMLElement>(shipyardBoosterCard, '.shipyard-card-availability');
        boosterAvailability.textContent = snapshot.booster.owned
            ? displayLabels.shipyardOwned
            : snapshot.booster.available
                ? ''
                : `${displayLabels.shipyardNotAvailable} - ${displayLabels.shipyardServicePlanet}: ${snapshot.booster.servicePlanetName}`;
        boosterAvailability.hidden = boosterAvailability.textContent === '';
        const boosterButton = required<HTMLButtonElement>(shipyardBoosterCard, '.shipyard-card-action');
        boosterButton.textContent = snapshot.booster.owned
            ? displayLabels.shipyardOwned
            : snapshot.booster.available ? displayLabels.shipyardPurchase : displayLabels.shipyardNotAvailable;
        boosterButton.setAttribute('aria-label', `${displayLabels.shipyardBooster}: ${boosterButton.textContent}`);
        boosterButton.disabled = snapshot.booster.owned || !snapshot.booster.available || !snapshot.booster.affordable;
    };
    const render = (snapshot: Readonly<LandingStatusSnapshot>): void => {
        modal.hidden = !snapshot.visible;
        if (snapshot.visible && !wasVisible) view = 'hub';
        hub.hidden = view !== 'hub';
        marketView.hidden = view !== 'market';
        facilitiesView.hidden = view !== 'facilities';
        shipyardView.hidden = view !== 'shipyard';
        landingVisual.style.backgroundImage = `url('${planetBackgroundAssetById[snapshot.planetId ?? ''] ?? '/assets/landing_bg_seroton.png'}')`;
        marketView.style.backgroundImage = `url('${planetBackgroundAssetById[snapshot.planetId ?? ''] ?? '/assets/landing_bg_seroton.png'}')`;
        if (title instanceof HTMLImageElement) {
            title.src = planetTitleAssetById[snapshot.planetId ?? ''] ?? '';
            title.alt = snapshot.planetName ?? '';
        } else {
            title.textContent = `${displayLabels.landedOn} ${snapshot.planetName ?? ''}`;
        }
        marketHeading.textContent = displayLabels.market;
        market.setAttribute('aria-label', displayLabels.market);
        marketBack.textContent = displayLabels.facilitiesBackToPlanet;
        marketBack.setAttribute('aria-label', displayLabels.facilitiesBackToPlanet);
        launch.setAttribute('aria-label', displayLabels.launch);
        facilities.setAttribute('aria-label', displayLabels.facilities);
        shipyard.setAttribute('aria-label', displayLabels.shipyard);
        marketCredits.textContent = formatCredits(snapshot.credits);
        marketCargo.textContent = `${snapshot.cargoUsed} / ${snapshot.cargoCapacity}`;
        marketClock.textContent = clockText(snapshot.clock);
        marketClock.setAttribute('aria-label', marketClock.textContent);
        const commodity = snapshot.commodities.find(candidate => candidate.commodityId === snapshot.selectedCommodityId);
        const signed = (value: number): string => value > 0 ? `+${value}` : String(value);
        const stockWithDelta = (element: HTMLElement, value: number, delta: number, decreaseIsBad: boolean): void => {
            const deltaElement = document.createElement('span');
            deltaElement.className = delta === 0 ? 'market-stock-delta' : `market-stock-delta ${decreaseIsBad === (delta < 0) ? 'market-stock-delta--negative' : 'market-stock-delta--positive'}`;
            deltaElement.textContent = ` (${signed(delta)})`;
            element.replaceChildren(String(value), deltaElement);
        };
        const selected = snapshot.selectedCommodity;
        commodityName.textContent = commodityLabels[selected.commodityId];
        commodityIcon.setAttribute('aria-label', `${commodityLabels[selected.commodityId]}${displayLabels.commodityIconSuffix}`);
        commodityIcon.dataset.commodityId = selected.commodityId;
        stockWithDelta(planetStock, snapshot.quote.postTradeStock, snapshot.plannedStockDelta, true);
        supply.textContent = `${displayLabels.supply}: ${snapshot.supplyLevel}`;
        supply.dataset.supplyLevel = snapshot.supplyLevel;
        production.textContent = `${displayLabels.marketProduction}: ${snapshot.commodityFlow.productionPerSecond} ${commodityLabels[selected.commodityId]} ${displayLabels.facilityPerCycle}`;
        consumption.textContent = `${displayLabels.marketConsumption}: ${snapshot.commodityFlow.consumptionPerSecond} ${commodityLabels[selected.commodityId]} ${displayLabels.facilityPerCycle}`;
        stockChange.textContent = `${displayLabels.marketStockChange}: ${signed(snapshot.commodityFlow.netPerSecond)} ${commodityLabels[selected.commodityId]} ${displayLabels.facilityPerCycle}`;
        stockChange.classList.toggle('market-stock-delta--positive', snapshot.commodityFlow.netPerSecond > 0);
        stockChange.classList.toggle('market-stock-delta--negative', snapshot.commodityFlow.netPerSecond < 0);
        stockWithDelta(playerStock, selected.carriedQuantity + snapshot.plannedCargoDelta, snapshot.plannedCargoDelta, true);
        const postTradeQuantity = selected.carriedQuantity + snapshot.plannedCargoDelta;
        const postTradeAverageBuyPrice = snapshot.tradeQuantity > 0
            ? ((selected.carriedQuantity * selected.averageBuyPrice) + snapshot.quote.total) / postTradeQuantity
            : postTradeQuantity === 0 ? 0 : selected.averageBuyPrice;
        averageBuyPrice.textContent = `${displayLabels.averageBuyPrice}: ${formatCredits(postTradeAverageBuyPrice)}`;
        const tradeResultValue = snapshot.tradeQuantity < 0 ? snapshot.quote.total - (Math.abs(snapshot.tradeQuantity) * selected.averageBuyPrice) : 0;
        if (snapshot.tradeQuantity === 0) {
            tradeIncome.replaceChildren();
        } else {
            const isExpense = snapshot.tradeQuantity > 0;
            const incomeLabelNode = document.createElement('span');
            incomeLabelNode.className = 'market-trade-income-label';
            incomeLabelNode.textContent = `${isExpense ? displayLabels.expense : displayLabels.tradeIncome}: `;
            const incomeValueNode = document.createElement('span');
            incomeValueNode.className = isExpense ? 'market-trade-income-value market-trade-income-value--expense' : 'market-trade-income-value';
            incomeValueNode.textContent = `${isExpense ? '-' : '+'}${formatCredits(snapshot.quote.total)}`;
            tradeIncome.replaceChildren(incomeLabelNode, incomeValueNode);
        }
        if (snapshot.tradeQuantity < 0) {
            const resultLabelNode = document.createElement('span');
            resultLabelNode.className = 'market-trade-result-label';
            resultLabelNode.textContent = tradeResultValue >= 0 ? displayLabels.profit : displayLabels.loss;
            const resultValueNode = document.createElement('span');
            resultValueNode.className = 'market-trade-result-value';
            resultValueNode.textContent = `${tradeResultValue >= 0 ? '+' : '-'}${formatCredits(Math.abs(tradeResultValue))}`;
            tradeResult.replaceChildren(resultLabelNode, resultValueNode);
        } else {
            tradeResult.replaceChildren();
        }
        tradeResult.className = snapshot.tradeQuantity < 0 ? `market-trade-result ${tradeResultValue >= 0 ? 'market-trade-result--profit' : 'market-trade-result--loss'}` : 'market-trade-result';
        quantity.min = String(commodity ? -commodity.carriedQuantity : 0);
        quantity.max = String(commodity ? Math.min(commodity.stock, snapshot.cargoCapacity - snapshot.cargoUsed) : 0);
        quantity.value = String(snapshot.tradeQuantity);
        quantity.disabled = !snapshot.eligible;
        quantityLabel.textContent = `${displayLabels.marketQuantity}: ${commodity ? commodityLabels[commodity.commodityId] : ''}`;
        unitPrice.textContent = `Price: ${formatCredits(snapshot.quote.nextUnitPrice)}`;
        quantityValue.textContent = snapshot.tradeQuantity > 0 ? `+${snapshot.tradeQuantity} ${displayLabels.marketBuy}` : snapshot.tradeQuantity < 0 ? `${Math.abs(snapshot.tradeQuantity)} ${displayLabels.marketSell}` : displayLabels.marketNoTrade;
        budget.textContent = snapshot.quote.failure === 'insufficient-credits'
            ? `${displayLabels.outOfBudget} — ${displayLabels.marketCashShortfall} ${formatCredits(Math.max(0, snapshot.quote.total - snapshot.credits))}`
            : displayLabels.inBudget;
        budget.classList.toggle('market-budget--warning', snapshot.quote.failure === 'insufficient-credits');
        confirm.textContent = displayLabels.marketConfirm;
        confirm.disabled = !snapshot.eligible || snapshot.quote.failure !== null;
        for (const button of catalogue) {
            const commodityId = button.dataset.commodityId as LandingCommodityId;
            const nameElement = required<HTMLElement>(button, '.catalogue-commodity-name');
            nameElement.textContent = commodityLabels[commodityId];
            button.setAttribute('aria-pressed', String(commodityId === snapshot.selectedCommodityId));
            button.disabled = !snapshot.eligible;
        }
        if (snapshot.visible && !wasVisible) market.focus();
        wasVisible = snapshot.visible;
    };
    const select = (event: Event): void => { port.selectCommodity((event.currentTarget as HTMLButtonElement).dataset.commodityId as LandingCommodityId); };
    const setQuantity = (): void => { port.setTradeQuantity(Number(quantity.value)); };
    const openMarket = (): void => {
        view = 'market';
        hub.hidden = true;
        marketView.hidden = false;
        facilitiesView.hidden = true;
        port.selectCommodity('milk');
        port.setTradeQuantity(0);
        catalogue[0]?.focus();
    };
    const returnToHub = (): void => { view = 'hub'; hub.hidden = false; marketView.hidden = true; facilitiesView.hidden = true; market.focus(); };
    const openFacilities = (): void => {
        view = 'facilities';
        hub.hidden = true;
        marketView.hidden = true;
        shipyardView.hidden = true;
        facilitiesView.hidden = false;
        const primaryAction = facilityActionButtons.values().next().value;
        if (primaryAction && !primaryAction.disabled) primaryAction.focus();
        else facilitiesBack.focus();
    };
    const returnFromFacilities = (): void => { view = 'hub'; hub.hidden = false; marketView.hidden = true; facilitiesView.hidden = true; shipyardView.hidden = true; facilities.focus(); };
    const openShipyard = (): void => {
        view = 'shipyard';
        hub.hidden = true;
        marketView.hidden = true;
        facilitiesView.hidden = true;
        shipyardView.hidden = false;
        if (!shipyardRepairButton.disabled) shipyardRepairButton.focus();
        else shipyardBack.focus();
    };
    const returnFromShipyard = (): void => { view = 'hub'; hub.hidden = false; marketView.hidden = true; facilitiesView.hidden = true; shipyardView.hidden = true; shipyard.focus(); };
    const chooseServiceUpgrade = (event: Event): void => {
        const button = event.currentTarget as HTMLButtonElement;
        const serviceId = button.dataset.serviceId as LandingShipServiceId | undefined;
        if (serviceId) port.upgradeShipService(serviceId);
    };
    const purchaseBooster = (): void => { port.purchaseBooster(); };
    const launchGame = (): void => { port.launch(); root.querySelector<HTMLCanvasElement>('#game-container canvas')?.focus(); };
    const keydown = (event: KeyboardEvent): void => {
        if (event.key !== 'Tab' || modal.hidden) return;
        const controls = focusable(); const first = controls[0]; const last = controls[controls.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const unsubscribe = port.subscribe(render);
    const unsubscribeFacilities = port.subscribeFacilities(renderFacilities);
    const unsubscribeShipyard = port.subscribeShipyard(renderShipyard);
    for (const button of catalogue) button.addEventListener('click', select);
    quantity.addEventListener('input', setQuantity);
    confirm.addEventListener('click', port.confirmTrade);
    market.addEventListener('click', openMarket);
    marketBack.addEventListener('click', returnToHub);
    facilities.addEventListener('click', openFacilities);
    facilitiesBack.addEventListener('click', returnFromFacilities);
    shipyard.addEventListener('click', openShipyard);
    shipyardBack.addEventListener('click', returnFromShipyard);
    shipyardRepairButton.addEventListener('click', port.repairShip);
    for (const card of shipyardCards) required<HTMLButtonElement>(card, '.shipyard-card-action').addEventListener('click', chooseServiceUpgrade);
    required<HTMLButtonElement>(shipyardBoosterCard, '.shipyard-card-action').addEventListener('click', purchaseBooster);
    launch.addEventListener('click', launchGame);
    window.addEventListener('keydown', keydown);
    let destroyed = false;
    return { destroy: () => {
        if (destroyed) return;
        destroyed = true;
        unsubscribe();
        unsubscribeFacilities();
        unsubscribeShipyard();
        for (const button of catalogue) button.removeEventListener('click', select);
        quantity.removeEventListener('input', setQuantity);
        confirm.removeEventListener('click', port.confirmTrade);
        market.removeEventListener('click', openMarket);
        marketBack.removeEventListener('click', returnToHub);
        facilities.removeEventListener('click', openFacilities);
        facilitiesBack.removeEventListener('click', returnFromFacilities);
        shipyard.removeEventListener('click', openShipyard);
        shipyardBack.removeEventListener('click', returnFromShipyard);
        shipyardRepairButton.removeEventListener('click', port.repairShip);
        for (const card of shipyardCards) required<HTMLButtonElement>(card, '.shipyard-card-action').removeEventListener('click', chooseServiceUpgrade);
        required<HTMLButtonElement>(shipyardBoosterCard, '.shipyard-card-action').removeEventListener('click', purchaseBooster);
        for (const button of facilityActionButtons.values()) button.removeEventListener('click', chooseFacilityInvestment);
        facilityActionButtons.clear();
        launch.removeEventListener('click', launchGame);
        window.removeEventListener('keydown', keydown);
        window.clearInterval(landedBadgeTimer);
        port.destroy();
    } };
}
