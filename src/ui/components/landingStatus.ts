import type {
    LandingCommodityId, LandingFacilityId, LandingShipServiceId, LandedFacilitiesSnapshot, LandedShipyardSnapshot,
    LandingStatusSnapshot, LandingStatusPort, UiHandle
} from '../contracts';
import { displayLabels } from './displayLabels';
import { formatCredits } from './formatCredits';
import { mountLandingMenuHeader } from './landingMenuHeader';

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
const shipServiceCapabilityText: Readonly<Record<LandingShipServiceId, (value: number) => string>> = {
    cargo: value => `${displayLabels.shipyardCapabilityCargo} ${value} ${displayLabels.shipyardCapabilityUnits}`,
    engine: value => `${displayLabels.shipyardCapabilityEngine} ${value}${displayLabels.shipyardCapabilityPercent}`,
    weaponary: value => `${displayLabels.shipyardCapabilityWeaponary} ${value} ${value === 1 ? displayLabels.shipyardCapabilityProjectile : displayLabels.shipyardCapabilityProjectiles}`
};
const shipServiceNotes: Readonly<Record<LandingShipServiceId, string>> = {
    cargo: displayLabels.shipyardNoteCargo,
    engine: displayLabels.shipyardNoteEngine,
    weaponary: displayLabels.shipyardNoteWeaponary
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
    const facilitiesClockElement = required<HTMLElement>(root, '#landing-status-facilities-clock');
    const facilitiesCredits = required<HTMLElement>(root, '#landing-status-facilities-credits');
    const facilitiesCargo = required<HTMLElement>(root, '#landing-status-facilities-cargo');
    const shipyardHeading = required<HTMLElement>(root, '#landing-status-shipyard-heading');
    const shipyardPlanet = required<HTMLElement>(root, '#landing-status-shipyard-planet');
    const shipyardBack = required<HTMLButtonElement>(root, '#landing-status-shipyard-back');
    const shipyardClockElement = required<HTMLElement>(root, '#landing-status-shipyard-clock');
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
    const marketClockElement = required<HTMLElement>(root, '#landing-status-market-clock');
    const marketCredits = required<HTMLElement>(root, '#landing-status-market-credits');
    const marketCargo = required<HTMLElement>(root, '#landing-status-market-cargo');
    const commodityName = required<HTMLElement>(root, '#landing-status-commodity-name');
    const planetStockBar = required<HTMLElement>(root, '#landing-status-planet-stock-bar');
    const planetStock = required<HTMLElement>(root, '#landing-status-planet-stock');
    const supply = required<HTMLElement>(root, '#landing-status-supply');
    const production = required<HTMLElement>(root, '#landing-status-production');
    const consumption = required<HTMLElement>(root, '#landing-status-consumption');
    const stockChange = required<HTMLElement>(root, '#landing-status-stock-change');
    const playerStock = required<HTMLElement>(root, '#landing-status-player-stock');
    const playerStockHeading = required<HTMLElement>(root, '#landing-status-player-stock-heading');
    const playerStockBar = required<HTMLElement>(root, '#landing-status-player-stock-bar');
    const averageBuyPrice = required<HTMLElement>(root, '#landing-status-average-buy-price');
    const tradeIncome = required<HTMLElement>(root, '#landing-status-trade-income');
    const tradeResult = required<HTMLElement>(root, '#landing-status-trade-result');
    const quantityLabel = required<HTMLElement>(root, '#landing-status-quantity-label');
    const quantity = required<HTMLInputElement>(root, '#landing-status-quantity');
    const quantityValue = required<HTMLOutputElement>(root, '#landing-status-quantity-value');
    const unitPrice = required<HTMLElement>(root, '#landing-status-unit-price');
    const confirm = required<HTMLButtonElement>(root, '#landing-status-confirm');
    const confirmLabel = required<HTMLElement>(confirm, '.market-confirm-label');
    const confirmPrice = required<HTMLElement>(confirm, '.market-confirm-price');
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
    const facilityDowngradeButtons = new Map<LandingFacilityId, HTMLButtonElement>();
    const chooseFacilityInvestment = (event: Event): void => {
        const button = event.currentTarget as HTMLButtonElement;
        const facilityId = button.dataset.facilityId as LandingFacilityId | undefined;
        if (!facilityId) return;
        if (button.dataset.action === 'build') port.buildFacility(facilityId);
        else if (button.dataset.action === 'upgrade') port.upgradeFacility(facilityId);
    };
    const chooseFacilityDowngrade = (event: Event): void => {
        const facilityId = (event.currentTarget as HTMLButtonElement).dataset.facilityId as LandingFacilityId | undefined;
        if (facilityId) port.downgradeFacility(facilityId);
    };
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
    const renderRecipe = (element: HTMLElement, lead: string, parts: readonly Readonly<{ commodityId: LandingCommodityId; quantity: number }>[], missing = false): void => {
        if (parts.length === 0) {
            element.replaceChildren();
            element.textContent = displayLabels.facilityNoInputs;
            element.classList.toggle('facility-card-recipe-empty', true);
            return;
        }
        element.classList.toggle('facility-card-recipe-empty', false);
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
        if (missing) {
            const missingNode = document.createElement('span');
            missingNode.className = 'facility-card-missing';
            missingNode.textContent = ` ${displayLabels.facilityMissing}`;
            nodes.push(missingNode);
        }
        element.replaceChildren(...nodes);
    };
    const renderFacilities = (snapshot: Readonly<LandedFacilitiesSnapshot>): void => {
        facilitiesHeading.textContent = displayLabels.facilities;
        facilitiesHeader.render(snapshot);
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
            const outputPerCycle = row.level > 0 ? row.outputPerCycle : row.buildOutputPerCycle;
            const inputsPerCycle = row.level > 0 ? row.inputsPerCycle : row.buildInputsPerCycle;
            renderRecipe(outputElement, displayLabels.facilityProduces, [{ commodityId: row.outputCommodityId, quantity: outputPerCycle }], row.status === 'insufficientResources');
            const inputsElement = required<HTMLElement>(card, '.facility-card-inputs');
            renderRecipe(inputsElement, displayLabels.facilityConsumes, inputsPerCycle);
            const modifierElement = required<HTMLElement>(card, '.facility-card-modifier');
            modifierElement.textContent = modifierText(row.modifier);
            modifierElement.hidden = modifierElement.textContent === '';
            const actionButton = required<HTMLButtonElement>(card, '.facility-card-action');
            required<HTMLElement>(actionButton, '.facility-card-action-label').textContent = row.action.kind === 'build' ? displayLabels.facilityBuild : row.action.kind === 'upgrade' ? displayLabels.facilityUpgrade : displayLabels.facilityMaxLevel;
            const actionPrice = required<HTMLElement>(actionButton, '.facility-card-action-price');
            actionPrice.textContent = row.action.kind === 'max' ? '' : formatCredits(row.action.price);
            actionPrice.hidden = row.action.kind === 'max';
            actionButton.dataset.action = row.action.kind;
            actionButton.disabled = row.action.kind !== 'max' && !row.action.affordable;
            const actionText = row.action.kind === 'build' ? displayLabels.facilityBuild : row.action.kind === 'upgrade' ? displayLabels.facilityUpgrade : displayLabels.facilityMaxLevel;
            actionButton.setAttribute('aria-label', `${row.label}: ${actionText}`);
            if (!facilityActionButtons.has(row.facilityId)) {
                actionButton.dataset.facilityId = row.facilityId;
                actionButton.addEventListener('click', chooseFacilityInvestment);
                facilityActionButtons.set(row.facilityId, actionButton);
            }
            const downgradeButton = required<HTMLButtonElement>(card, '.facility-card-downgrade');
            required<HTMLElement>(downgradeButton, '.facility-card-downgrade-label').textContent = displayLabels.facilityDowngrade;
            const downgradeRefund = required<HTMLElement>(downgradeButton, '.facility-card-downgrade-refund');
            required<HTMLElement>(downgradeRefund, '.facility-card-downgrade-refund-label').textContent = row.downgrade.available
                ? `${displayLabels.facilityRefund} - `
                : displayLabels.facilityDowngradeUnavailable;
            required<HTMLElement>(downgradeRefund, '.facility-card-downgrade-coin').hidden = !row.downgrade.available;
            required<HTMLElement>(downgradeRefund, '.facility-card-downgrade-amount').textContent = row.downgrade.available
                ? formatCredits(row.downgrade.refund)
                : '';
            downgradeButton.disabled = !row.downgrade.available;
            downgradeButton.dataset.facilityId = row.facilityId;
            downgradeButton.setAttribute('aria-label', row.downgrade.available
                ? `${row.label}: ${displayLabels.facilityDowngrade}, ${displayLabels.facilityRefund} ${formatCredits(row.downgrade.refund)}`
                : `${row.label}: ${displayLabels.facilityDowngrade} ${displayLabels.facilityDowngradeUnavailable}`);
            if (!facilityDowngradeButtons.has(row.facilityId)) {
                downgradeButton.addEventListener('click', chooseFacilityDowngrade);
                facilityDowngradeButtons.set(row.facilityId, downgradeButton);
            }
        }
    };
    const renderShipyard = (snapshot: Readonly<LandedShipyardSnapshot>): void => {
        shipyardHeading.textContent = displayLabels.shipyard;
        shipyardHeader.render(snapshot);
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
        repairBar.dataset.healthBand = snapshot.repair.healthBand;
        const repairIncrement = Math.round(snapshot.repair.incrementHitPoints / snapshot.repair.maximumHitPoints * 100);
        required<HTMLElement>(shipyardRepairButton, '.shipyard-card-action-label').textContent =
            `${displayLabels.shipyardRepairAction} ${repairIncrement}% ${displayLabels.shipyardMaxHitPoints}`;
        required<HTMLElement>(shipyardRepairButton, '.shipyard-card-action-price').textContent = formatCredits(snapshot.repair.price);
        shipyardRepairButton.setAttribute('aria-label',
            `${displayLabels.shipyardRepair}: ${displayLabels.shipyardRepairAction} ${repairIncrement}% ${displayLabels.shipyardMaxHitPoints} ${formatCredits(snapshot.repair.price)}`);
        shipyardRepairButton.disabled = snapshot.repair.failure !== null;

        for (const card of shipyardCards) {
            const serviceId = card.dataset.serviceId as LandingShipServiceId;
            const row = snapshot.services.find(candidate => candidate.serviceId === serviceId);
            if (!row) throw new Error(`Missing ship-service row: ${serviceId}`);
            required<HTMLElement>(card, '.shipyard-card-icon').setAttribute('aria-label', `${row.label}${displayLabels.shipServiceIconSuffix}`);
            required<HTMLElement>(card, '.shipyard-card-name').textContent = row.label;
            required<HTMLElement>(card, '.shipyard-card-level').textContent = `${displayLabels.facilityLevel} ${row.level} / ${row.maximumLevel}`;
            required<HTMLElement>(card, '.shipyard-card-capability').textContent = shipServiceCapabilityText[row.serviceId](row.currentCapability);
            required<HTMLElement>(card, '.shipyard-card-note').textContent = shipServiceNotes[row.serviceId];
            const availability = required<HTMLElement>(card, '.shipyard-card-availability');
            const availabilityState = required<HTMLElement>(availability, '.shipyard-card-availability-state');
            const availabilityLabel = required<HTMLElement>(availability, '.shipyard-card-availability-label');
            const availabilityPlanet = required<HTMLElement>(availability, '.shipyard-card-availability-planet');
            availabilityState.textContent = row.available ? '' : `${displayLabels.shipyardNotAvailable}.`;
            availabilityLabel.textContent = row.available ? '' : `${displayLabels.shipyardServicePlanet}:`;
            availabilityPlanet.textContent = row.available ? '' : row.servicePlanetName;
            availability.hidden = row.available;
            const actionButton = required<HTMLButtonElement>(card, '.shipyard-card-action');
            actionButton.dataset.serviceId = row.serviceId;
            const actionLabel = required<HTMLElement>(actionButton, '.shipyard-card-action-label');
            const actionPrice = required<HTMLElement>(actionButton, '.shipyard-card-action-price');
            actionLabel.textContent = row.maximum
                ? displayLabels.facilityMaxLevel
                : row.available ? displayLabels.facilityUpgrade : displayLabels.shipyardNotAvailable;
            actionPrice.textContent = row.price > 0 ? formatCredits(row.price) : '';
            actionPrice.hidden = row.price <= 0;
            actionButton.setAttribute('aria-label', row.price > 0
                ? `${row.label}: ${actionLabel.textContent} ${formatCredits(row.price)}`
                : `${row.label}: ${actionLabel.textContent}`);
            actionButton.disabled = !row.available || !row.affordable;
            actionButton.hidden = actionLabel.textContent === displayLabels.shipyardNotAvailable;
        }

        required<HTMLElement>(shipyardBoosterCard, '.shipyard-card-name').textContent = displayLabels.shipyardBooster;
        required<HTMLElement>(shipyardBoosterCard, '.shipyard-card-icon').setAttribute('aria-label', `${displayLabels.shipyardBooster}${displayLabels.shipServiceIconSuffix}`);
        required<HTMLElement>(shipyardBoosterCard, '.shipyard-card-effect').textContent = displayLabels.shipyardBoosterEffect;
        const boosterAvailability = required<HTMLElement>(shipyardBoosterCard, '.shipyard-card-availability');
        const boosterAvailabilityState = required<HTMLElement>(boosterAvailability, '.shipyard-card-availability-state');
        const boosterAvailabilityLabel = required<HTMLElement>(boosterAvailability, '.shipyard-card-availability-label');
        const boosterAvailabilityPlanet = required<HTMLElement>(boosterAvailability, '.shipyard-card-availability-planet');
        const boosterUnavailable = !snapshot.booster.available && !snapshot.booster.owned;
        boosterAvailabilityState.textContent = snapshot.booster.owned ? displayLabels.shipyardOwned : boosterUnavailable ? `${displayLabels.shipyardNotAvailable}.` : '';
        boosterAvailabilityLabel.textContent = boosterUnavailable ? `${displayLabels.shipyardServicePlanet}:` : '';
        boosterAvailabilityPlanet.textContent = boosterUnavailable ? snapshot.booster.servicePlanetName : '';
        boosterAvailability.hidden = !snapshot.booster.owned && !boosterUnavailable;
        const boosterButton = required<HTMLButtonElement>(shipyardBoosterCard, '.shipyard-card-action');
        const boosterLabel = required<HTMLElement>(boosterButton, '.shipyard-card-action-label');
        const boosterPrice = required<HTMLElement>(boosterButton, '.shipyard-card-action-price');
        boosterLabel.textContent = snapshot.booster.owned
            ? displayLabels.shipyardOwned
            : snapshot.booster.available ? displayLabels.shipyardPurchase : displayLabels.shipyardNotAvailable;
        boosterPrice.textContent = snapshot.booster.owned ? '' : formatCredits(snapshot.booster.price);
        boosterPrice.hidden = snapshot.booster.owned;
        boosterButton.setAttribute('aria-label', snapshot.booster.owned
            ? `${displayLabels.shipyardBooster}: ${boosterLabel.textContent}`
            : `${displayLabels.shipyardBooster}: ${boosterLabel.textContent} ${formatCredits(snapshot.booster.price)}`);
        boosterButton.disabled = snapshot.booster.owned || !snapshot.booster.available || !snapshot.booster.affordable;
        boosterButton.hidden = boosterLabel.textContent === displayLabels.shipyardNotAvailable;
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
        marketHeader.render(snapshot);
        launch.setAttribute('aria-label', displayLabels.launch);
        facilities.setAttribute('aria-label', displayLabels.facilities);
        shipyard.setAttribute('aria-label', displayLabels.shipyard);
        const commodity = snapshot.commodities.find(candidate => candidate.commodityId === snapshot.selectedCommodityId);
        const signed = (value: number): string => value > 0 ? `+${value}` : String(value);
        const stockWithDelta = (element: HTMLElement, value: number, delta: number, decreaseIsBad: boolean): void => {
            const deltaElement = document.createElement('span');
            deltaElement.className = delta === 0 ? 'market-stock-delta' : `market-stock-delta ${decreaseIsBad === (delta < 0) ? 'market-stock-delta--negative' : 'market-stock-delta--positive'}`;
            deltaElement.textContent = ` (${signed(delta)})`;
            element.replaceChildren(String(value), deltaElement);
        };
    const renderStockBar = (element: HTMLElement, amount: number, capacity: number, label: string): void => {
        const fill = required<HTMLElement>(element, '.market-stock-fill');
        const percentage = capacity > 0 ? Math.min(100, Math.max(0, amount / capacity * 100)) : 0;
        fill.style.width = `${percentage}%`;
        element.setAttribute('aria-valuemin', '0');
        element.setAttribute('aria-valuemax', String(capacity));
        element.setAttribute('aria-valuenow', String(Math.min(capacity, Math.max(0, amount))));
        element.setAttribute('aria-valuetext', `${amount} of ${capacity}`);
        element.setAttribute('aria-label', label);
    };
    const renderPlanetStockBar = (
        element: HTMLElement,
        amount: number,
        capacity: number,
        lowerThreshold: number,
        upperThreshold: number,
        label: string
    ): void => {
        const boundedAmount = Math.min(capacity, Math.max(0, amount));
        const segments = [
            { selector: '.market-stock-segment--low', start: 0, end: lowerThreshold },
            { selector: '.market-stock-segment--medium', start: lowerThreshold, end: upperThreshold },
            { selector: '.market-stock-segment--high', start: upperThreshold, end: capacity }
        ];
        for (const segment of segments) {
            const segmentElement = required<HTMLElement>(element, segment.selector);
            const fill = required<HTMLElement>(segmentElement, '.market-stock-fill');
            const segmentCapacity = Math.max(0, segment.end - segment.start);
            segmentElement.style.flex = `0 0 ${capacity > 0 ? segmentCapacity / capacity * 100 : 0}%`;
            const amountInSegment = Math.min(segmentCapacity, Math.max(0, boundedAmount - segment.start));
            fill.style.width = `${segmentCapacity > 0 ? amountInSegment / segmentCapacity * 100 : 0}%`;
        }
        element.setAttribute('aria-valuemin', '0');
        element.setAttribute('aria-valuemax', String(capacity));
        element.setAttribute('aria-valuenow', String(boundedAmount));
        element.setAttribute('aria-valuetext', `${amount} of ${capacity}`);
        element.setAttribute('aria-label', label);
    };
        const selected = snapshot.selectedCommodity;
        commodityName.textContent = `${displayLabels.planetaryStockOf}: ${commodityLabels[selected.commodityId]}`;
        playerStockHeading.textContent = `${displayLabels.shipStockOf}: ${commodityLabels[selected.commodityId]}`;
        commodityIcon.setAttribute('aria-label', `${commodityLabels[selected.commodityId]}${displayLabels.commodityIconSuffix}`);
        commodityIcon.dataset.commodityId = selected.commodityId;
        stockWithDelta(planetStock, snapshot.quote.postTradeStock, snapshot.plannedStockDelta, true);
        renderPlanetStockBar(
            planetStockBar,
            snapshot.quote.postTradeStock,
            selected.stockCapacity,
            selected.lowerStockThreshold,
            selected.upperStockThreshold,
            `${displayLabels.planetStock}: ${commodityLabels[selected.commodityId]}`
        );
        supply.textContent = `${displayLabels.supply}: ${snapshot.supplyLevel}`;
        supply.dataset.supplyLevel = snapshot.supplyLevel;
        production.textContent = `${displayLabels.marketProduction}: ${snapshot.commodityFlow.productionPerSecond} ${commodityLabels[selected.commodityId]} ${displayLabels.facilityPerCycle}`;
        consumption.textContent = `${displayLabels.marketConsumption}: ${snapshot.commodityFlow.consumptionPerSecond} ${commodityLabels[selected.commodityId]} ${displayLabels.facilityPerCycle}`;
        const stockChangeLabel = document.createElement('span');
        stockChangeLabel.className = 'market-stock-change-label';
        stockChangeLabel.textContent = `${displayLabels.marketStockChange}:`;
        const stockChangeRate = document.createElement('span');
        stockChangeRate.className = 'market-stock-change-rate';
        stockChangeRate.dataset.commodityId = selected.commodityId;
        stockChangeRate.textContent = `${signed(snapshot.commodityFlow.netPerSecond)}/s`;
        stockChange.replaceChildren(stockChangeLabel, stockChangeRate);
        stockChange.classList.toggle('market-stock-delta--positive', snapshot.commodityFlow.netPerSecond > 0);
        stockChange.classList.toggle('market-stock-delta--negative', snapshot.commodityFlow.netPerSecond < 0);
        stockWithDelta(playerStock, selected.carriedQuantity + snapshot.plannedCargoDelta, snapshot.plannedCargoDelta, true);
        const postTradeQuantity = selected.carriedQuantity + snapshot.plannedCargoDelta;
        renderStockBar(playerStockBar, postTradeQuantity, snapshot.cargoCapacity, `${displayLabels.playerStock}: ${commodityLabels[selected.commodityId]}`);
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
        const insufficientCash = snapshot.quote.failure === 'insufficient-credits'
            || (snapshot.tradeQuantity > 0 && snapshot.quote.total > snapshot.credits);
        const cashShortfall = Math.max(0, snapshot.quote.total - snapshot.credits);
        confirmLabel.textContent = insufficientCash ? displayLabels.marketInsufficientCash : displayLabels.marketConfirm;
        confirmPrice.textContent = formatCredits(insufficientCash ? cashShortfall : snapshot.quote.total);
        confirmPrice.dataset.state = insufficientCash ? 'insufficient-credits' : 'ready';
        confirm.dataset.state = insufficientCash ? 'insufficient-credits' : 'ready';
        confirm.disabled = !snapshot.eligible || snapshot.quote.failure !== null || insufficientCash;
        confirm.setAttribute('aria-label', insufficientCash
            ? `${displayLabels.marketInsufficientCash}: ${formatCredits(cashShortfall)} ${displayLabels.marketCredits}`
            : `${displayLabels.marketConfirm}: ${formatCredits(snapshot.quote.total)}`);
        for (const button of catalogue) {
            const commodityId = button.dataset.commodityId as LandingCommodityId;
            const nameElement = required<HTMLElement>(button, '.catalogue-commodity-name');
            const commoditySnapshot = snapshot.commodities.find(candidate => candidate.commodityId === commodityId);
            if (!commoditySnapshot) throw new Error(`Missing catalogue commodity ${commodityId}.`);
            const netRate = commoditySnapshot.netPerSecond ?? 0;
            nameElement.textContent = `${commodityLabels[commodityId]} (${signed(netRate)}/s)`;
            button.dataset.supplyLevel = commoditySnapshot.supplyLevel;
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
        else facilitiesHeader.backButton.focus();
    };
    const returnFromFacilities = (): void => { view = 'hub'; hub.hidden = false; marketView.hidden = true; facilitiesView.hidden = true; shipyardView.hidden = true; facilities.focus(); };
    const openShipyard = (): void => {
        view = 'shipyard';
        hub.hidden = true;
        marketView.hidden = true;
        facilitiesView.hidden = true;
        shipyardView.hidden = false;
        if (!shipyardRepairButton.disabled) shipyardRepairButton.focus();
        else shipyardHeader.backButton.focus();
    };
    const returnFromShipyard = (): void => { view = 'hub'; hub.hidden = false; marketView.hidden = true; facilitiesView.hidden = true; shipyardView.hidden = true; shipyard.focus(); };
    const chooseServiceUpgrade = (event: Event): void => {
        const button = event.currentTarget as HTMLButtonElement;
        const serviceId = button.dataset.serviceId as LandingShipServiceId | undefined;
        if (serviceId) port.upgradeShipService(serviceId);
    };
    const purchaseBooster = (): void => { port.purchaseBooster(); };
    const launchGame = (): void => { port.launch(); root.querySelector<HTMLCanvasElement>('#game-container canvas')?.focus(); };
    const marketHeader = mountLandingMenuHeader(marketBack, marketClockElement, marketCredits, marketCargo, () => !marketView.hidden && !modal.hidden, returnToHub);
    const facilitiesHeader = mountLandingMenuHeader(facilitiesBack, facilitiesClockElement, facilitiesCredits, facilitiesCargo, () => !facilitiesView.hidden && !modal.hidden, returnFromFacilities);
    const shipyardHeader = mountLandingMenuHeader(shipyardBack, shipyardClockElement, shipyardCredits, shipyardCargo, () => !shipyardView.hidden && !modal.hidden, returnFromShipyard);
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
    facilities.addEventListener('click', openFacilities);
    shipyard.addEventListener('click', openShipyard);
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
        facilities.removeEventListener('click', openFacilities);
        shipyard.removeEventListener('click', openShipyard);
        shipyardRepairButton.removeEventListener('click', port.repairShip);
        for (const card of shipyardCards) required<HTMLButtonElement>(card, '.shipyard-card-action').removeEventListener('click', chooseServiceUpgrade);
        required<HTMLButtonElement>(shipyardBoosterCard, '.shipyard-card-action').removeEventListener('click', purchaseBooster);
        for (const button of facilityActionButtons.values()) button.removeEventListener('click', chooseFacilityInvestment);
        facilityActionButtons.clear();
        for (const button of facilityDowngradeButtons.values()) button.removeEventListener('click', chooseFacilityDowngrade);
        facilityDowngradeButtons.clear();
        launch.removeEventListener('click', launchGame);
        window.removeEventListener('keydown', keydown);
        window.clearInterval(landedBadgeTimer);
        marketHeader.destroy();
        facilitiesHeader.destroy();
        shipyardHeader.destroy();
        port.destroy();
    } };
}
