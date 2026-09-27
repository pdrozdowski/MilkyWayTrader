import type { LandingCommodityId, LandingStatusSnapshot, LandingStatusPort, UiHandle } from '../contracts';
import { displayLabels } from './displayLabels';

function required<T extends Element> (root: HTMLElement, selector: string): T
{
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing landing status control: ${selector}`);
    return element;
}

const commodityLabels: Readonly<Record<LandingCommodityId, string>> = { supplies: displayLabels.supplies, alloys: displayLabels.alloys, medicines: displayLabels.medicines };
const formatCredits = (value: number): string => `${value.toLocaleString()} cr`;

export function mountLandingStatus (root: HTMLElement, port: LandingStatusPort): UiHandle
{
    const modal = required<HTMLElement>(root, '#landing-status');
    const title = required<HTMLElement>(root, '#landing-status-title');
    const credits = required<HTMLElement>(root, '#landing-status-credits');
    const cargo = required<HTMLElement>(root, '#landing-status-cargo');
    const balances = required<HTMLElement>(root, '#landing-status-balances');
    const commodityName = required<HTMLElement>(root, '#landing-status-commodity-name');
    const planetStock = required<HTMLElement>(root, '#landing-status-planet-stock');
    const production = required<HTMLElement>(root, '#landing-status-production');
    const consumption = required<HTMLElement>(root, '#landing-status-consumption');
    const supply = required<HTMLElement>(root, '#landing-status-supply');
    const playerStock = required<HTMLElement>(root, '#landing-status-player-stock');
    const averageBuyPrice = required<HTMLElement>(root, '#landing-status-average-buy-price');
    const tradeResultLabel = required<HTMLElement>(root, '#landing-status-trade-result-label');
    const tradeResult = required<HTMLElement>(root, '#landing-status-trade-result');
    const quantityLabel = required<HTMLElement>(root, '#landing-status-quantity-label');
    const quantity = required<HTMLInputElement>(root, '#landing-status-quantity');
    const quantityValue = required<HTMLOutputElement>(root, '#landing-status-quantity-value');
    const unitPrice = required<HTMLElement>(root, '#landing-status-unit-price');
    const quote = required<HTMLElement>(root, '#landing-status-quote');
    const budget = required<HTMLElement>(root, '#landing-status-budget');
    const confirm = required<HTMLButtonElement>(root, '#landing-status-confirm');
    const launch = required<HTMLButtonElement>(root, '#landing-status-launch');
    const commodityIcon = required<HTMLElement>(root, '.market-commodity-icon');
    const catalogue = Array.from(root.querySelectorAll<HTMLButtonElement>('#landing-status-catalogue [data-commodity-id]'));
    let wasVisible = false;
    const focusable = (): HTMLElement[] => Array.from(modal.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])'));
    const render = (snapshot: Readonly<LandingStatusSnapshot>): void => {
        modal.hidden = !snapshot.visible;
        title.textContent = 'SEROTON MARKET';
        balances.textContent = `${displayLabels.marketCredits}: ${formatCredits(snapshot.credits)} · ${displayLabels.marketCargo}: ${snapshot.cargoUsed} / ${snapshot.cargoCapacity}`;
        balances.replaceChildren(credits, cargo);
        credits.textContent = `${displayLabels.marketCredits}: ${formatCredits(snapshot.credits)}`;
        cargo.textContent = `${displayLabels.marketCargo}: ${snapshot.cargoUsed} / ${snapshot.cargoCapacity}`;
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
        commodityIcon.setAttribute('aria-label', `${commodityLabels[selected.commodityId]} commodity icon`);
        stockWithDelta(planetStock, snapshot.quote.postTradeStock, snapshot.plannedStockDelta, true);
        production.textContent = `${displayLabels.produces}: ${selected.productionPerSecond} / sec`;
        consumption.textContent = `${displayLabels.consumes}: ${selected.consumptionPerSecond} / sec`;
        supply.textContent = `${displayLabels.supply}: ${snapshot.supplyLevel}`;
        stockWithDelta(playerStock, selected.carriedQuantity + snapshot.plannedCargoDelta, snapshot.plannedCargoDelta, true);
        const postTradeQuantity = selected.carriedQuantity + snapshot.plannedCargoDelta;
        const postTradeAverageBuyPrice = snapshot.tradeQuantity > 0
            ? ((selected.carriedQuantity * selected.averageBuyPrice) + snapshot.quote.total) / postTradeQuantity
            : postTradeQuantity === 0 ? 0 : selected.averageBuyPrice;
        averageBuyPrice.textContent = `${displayLabels.averageBuyPrice}: ${formatCredits(postTradeAverageBuyPrice)}`;
        const tradeResultValue = snapshot.tradeQuantity < 0 ? snapshot.quote.total - (Math.abs(snapshot.tradeQuantity) * selected.averageBuyPrice) : 0;
        tradeResultLabel.textContent = snapshot.tradeQuantity < 0 ? displayLabels.tradeResult : '';
        tradeResult.textContent = snapshot.tradeQuantity < 0 ? `${tradeResultValue >= 0 ? displayLabels.profit : displayLabels.loss} ${tradeResultValue >= 0 ? `+${tradeResultValue}` : String(tradeResultValue)} cr` : '';
        tradeResult.className = snapshot.tradeQuantity < 0 ? `market-trade-result ${tradeResultValue >= 0 ? 'market-trade-result--profit' : 'market-trade-result--loss'}` : 'market-trade-result';
        quantity.min = String(commodity ? -commodity.carriedQuantity : 0);
        quantity.max = String(commodity ? Math.min(commodity.stock, snapshot.cargoCapacity - snapshot.cargoUsed) : 0);
        quantity.value = String(snapshot.tradeQuantity);
        quantity.disabled = !snapshot.eligible;
        quantityLabel.textContent = `${displayLabels.marketQuantity}: ${commodity ? commodityLabels[commodity.commodityId] : ''}`;
        unitPrice.textContent = `Price: ${formatCredits(snapshot.quote.nextUnitPrice)}`;
        quantityValue.textContent = snapshot.tradeQuantity > 0 ? `+${snapshot.tradeQuantity} ${displayLabels.marketBuy}` : snapshot.tradeQuantity < 0 ? `${Math.abs(snapshot.tradeQuantity)} ${displayLabels.marketSell}` : displayLabels.marketNoTrade;
        quote.textContent = `${displayLabels.marketQuote}: ${snapshot.quote.total === 0 ? '—' : formatCredits(snapshot.quote.total)}`;
        budget.textContent = snapshot.quote.failure === 'insufficient-credits'
            ? `${displayLabels.outOfBudget} — ${displayLabels.marketCashShortfall} ${formatCredits(Math.max(0, snapshot.quote.total - snapshot.credits))}`
            : displayLabels.inBudget;
        budget.classList.toggle('market-budget--warning', snapshot.quote.failure === 'insufficient-credits');
        confirm.textContent = displayLabels.marketConfirm;
        confirm.disabled = !snapshot.eligible || snapshot.quote.failure !== null;
        launch.textContent = displayLabels.launch;
        for (const button of catalogue) {
            const commodityId = button.dataset.commodityId as LandingCommodityId;
            const row = snapshot.commodities.find(candidate => candidate.commodityId === commodityId);
            button.textContent = row ? `${commodityLabels[commodityId]} · ${row.stock} · ${formatCredits(row.unitPrice)}` : commodityLabels[commodityId];
            button.textContent = row && row.carriedQuantity > 0 ? `${commodityLabels[commodityId]} · ${row.carriedQuantity}` : commodityLabels[commodityId];
            button.setAttribute('aria-pressed', String(commodityId === snapshot.selectedCommodityId));
            button.disabled = !snapshot.eligible;
        }
        if (snapshot.visible && !wasVisible) quantity.focus();
        wasVisible = snapshot.visible;
    };
    const select = (event: Event): void => { port.selectCommodity((event.currentTarget as HTMLButtonElement).dataset.commodityId as LandingCommodityId); };
    const setQuantity = (): void => { port.setTradeQuantity(Number(quantity.value)); };
    const launchGame = (): void => { port.launch(); root.querySelector<HTMLCanvasElement>('#game-container canvas')?.focus(); };
    const keydown = (event: KeyboardEvent): void => {
        if (event.key !== 'Tab' || modal.hidden) return;
        const controls = focusable(); const first = controls[0]; const last = controls[controls.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const unsubscribe = port.subscribe(render);
    for (const button of catalogue) button.addEventListener('click', select);
    quantity.addEventListener('input', setQuantity);
    confirm.addEventListener('click', port.confirmTrade);
    launch.addEventListener('click', launchGame);
    window.addEventListener('keydown', keydown);
    let destroyed = false;
    return { destroy: () => {
        if (destroyed) return;
        destroyed = true;
        unsubscribe();
        for (const button of catalogue) button.removeEventListener('click', select);
        quantity.removeEventListener('input', setQuantity);
        confirm.removeEventListener('click', port.confirmTrade);
        launch.removeEventListener('click', launchGame);
        window.removeEventListener('keydown', keydown);
        port.destroy();
    } };
}
