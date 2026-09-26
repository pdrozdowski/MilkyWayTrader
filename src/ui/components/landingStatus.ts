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
    const paused = required<HTMLElement>(root, '#landing-status-paused');
    const balances = required<HTMLElement>(root, '#landing-status-balances');
    const quantityLabel = required<HTMLElement>(root, '#landing-status-quantity-label');
    const quantity = required<HTMLInputElement>(root, '#landing-status-quantity');
    const quantityValue = required<HTMLOutputElement>(root, '#landing-status-quantity-value');
    const quote = required<HTMLElement>(root, '#landing-status-quote');
    const impact = required<HTMLElement>(root, '#landing-status-impact');
    const shortfall = required<HTMLElement>(root, '#landing-status-cash-shortfall');
    const confirm = required<HTMLButtonElement>(root, '#landing-status-confirm');
    const launch = required<HTMLButtonElement>(root, '#landing-status-launch');
    const catalogue = Array.from(root.querySelectorAll<HTMLButtonElement>('#landing-status-catalogue [data-commodity-id]'));
    let wasVisible = false;
    const focusable = (): HTMLElement[] => Array.from(modal.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])'));
    const render = (snapshot: Readonly<LandingStatusSnapshot>): void => {
        modal.hidden = !snapshot.visible;
        title.textContent = snapshot.planetName ? `${snapshot.planetName} ${displayLabels.landedSuffix}` : displayLabels.landed;
        paused.textContent = displayLabels.pausedTime;
        balances.textContent = `${displayLabels.marketCredits}: ${formatCredits(snapshot.credits)} · ${displayLabels.marketCargo}: ${snapshot.cargoUsed} / ${snapshot.cargoCapacity}`;
        const commodity = snapshot.commodities.find(candidate => candidate.commodityId === snapshot.selectedCommodityId);
        quantity.min = String(commodity ? -commodity.carriedQuantity : 0);
        quantity.max = String(commodity ? Math.min(commodity.stock, snapshot.cargoCapacity - snapshot.cargoUsed) : 0);
        quantity.value = String(snapshot.tradeQuantity);
        quantity.disabled = !snapshot.eligible;
        quantityLabel.textContent = `${displayLabels.marketQuantity}: ${commodity ? commodityLabels[commodity.commodityId] : ''}`;
        quantityValue.textContent = snapshot.tradeQuantity > 0 ? `+${snapshot.tradeQuantity} ${displayLabels.marketBuy}` : snapshot.tradeQuantity < 0 ? `${snapshot.tradeQuantity} ${displayLabels.marketSell}` : displayLabels.marketNoTrade;
        quote.textContent = `${displayLabels.marketQuote}: ${snapshot.quote.total === 0 ? '—' : formatCredits(snapshot.quote.total)}`;
        impact.textContent = `${displayLabels.marketPostTradeStock}: ${snapshot.quote.postTradeStock} · ${displayLabels.marketNextPrice}: ${formatCredits(snapshot.quote.nextUnitPrice)}`;
        shortfall.textContent = snapshot.quote.failure === 'insufficient-credits' ? `${displayLabels.marketCashShortfall} ${formatCredits(Math.max(0, snapshot.quote.total - snapshot.credits))}` : '';
        confirm.textContent = displayLabels.marketConfirm;
        confirm.disabled = !snapshot.eligible || snapshot.quote.failure !== null;
        launch.textContent = displayLabels.launch;
        for (const button of catalogue) {
            const commodityId = button.dataset.commodityId as LandingCommodityId;
            const row = snapshot.commodities.find(candidate => candidate.commodityId === commodityId);
            button.textContent = row ? `${commodityLabels[commodityId]} · ${row.stock} · ${formatCredits(row.unitPrice)}` : commodityLabels[commodityId];
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
