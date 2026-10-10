import type { CargoTransferPort, CargoTransferSnapshot, UiHandle } from '../contracts';
import { displayLabels } from './displayLabels';

function required<T extends Element> (root: HTMLElement, selector: string): T
{
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing cargo transfer control: ${selector}`);
    return element;
}

const commodityIds: readonly string[] = Object.keys(displayLabels.commodityLabels);
const commodityLabel = (commodityId: string): string => displayLabels.commodityLabels[commodityId as keyof typeof displayLabels.commodityLabels] ?? commodityId;

interface RowControls
{
    readonly commodityId: string;
    readonly section: HTMLElement;
    readonly cargoQuantity: HTMLElement;
    readonly shipQuantity: HTMLElement;
    readonly cargoIcon: HTMLElement;
    readonly shipIcon: HTMLElement;
    readonly name: HTMLElement;
    readonly toCargoMax: HTMLButtonElement;
    readonly toCargoOne: HTMLButtonElement;
    readonly toShipOne: HTMLButtonElement;
    readonly toShipMax: HTMLButtonElement;
}

export function mountCargoTransfer (root: HTMLElement, port: CargoTransferPort): UiHandle
{
    const modal = required<HTMLElement>(root, '#cargo-transfer');
    const title = required<HTMLElement>(root, '#cargo-transfer-title');
    const cargoHeader = required<HTMLElement>(root, '#cargo-transfer-cargo-header');
    const commodityHeader = required<HTMLElement>(root, '#cargo-transfer-commodity-header');
    const shipHeader = required<HTMLElement>(root, '#cargo-transfer-ship-header');
    const cargoUsage = required<HTMLElement>(root, '#cargo-transfer-cargo-usage');
    const shipUsage = required<HTMLElement>(root, '#cargo-transfer-ship-usage');
    const cargoCapacity = required<HTMLElement>(root, '#cargo-transfer-cargo-capacity');
    const shipCapacity = required<HTMLElement>(root, '#cargo-transfer-ship-capacity');
    const rowsContainer = required<HTMLElement>(root, '#cargo-transfer-rows');
    const warning = required<HTMLElement>(root, '#cargo-transfer-warning');
    const close = required<HTMLButtonElement>(root, '#cargo-transfer-close');
    const rows: readonly RowControls[] = commodityIds.map(commodityId => {
        const section = required<HTMLElement>(rowsContainer, `[data-commodity-id=${commodityId}]`);
        return {
            commodityId,
            section,
            cargoQuantity: required<HTMLElement>(section, '.cargo-transfer-row-cargo-quantity'),
            shipQuantity: required<HTMLElement>(section, '.cargo-transfer-row-ship-quantity'),
            cargoIcon: required<HTMLElement>(section, '.cargo-transfer-row-cargo .cargo-transfer-row-icon'),
            shipIcon: required<HTMLElement>(section, '.cargo-transfer-row-ship .cargo-transfer-row-icon'),
            name: required<HTMLElement>(section, '.cargo-transfer-row-name'),
            toCargoMax: required<HTMLButtonElement>(section, '.cargo-transfer-to-cargo-max'),
            toCargoOne: required<HTMLButtonElement>(section, '.cargo-transfer-to-cargo-one'),
            toShipOne: required<HTMLButtonElement>(section, '.cargo-transfer-to-ship-one'),
            toShipMax: required<HTMLButtonElement>(section, '.cargo-transfer-to-ship-max')
        };
    });
    const listeners: { readonly element: HTMLButtonElement; readonly listener: () => void }[] = [];
    const bind = (element: HTMLButtonElement, commodityId: string, direction: 'to-ship' | 'to-orbit', amount: 'one' | 'max'): void => {
        const listener = (): void => port.transfer(commodityId, direction, amount);
        element.addEventListener('click', listener);
        listeners.push({ element, listener });
    };
    for (const row of rows) {
        bind(row.toCargoMax, row.commodityId, 'to-orbit', 'max');
        bind(row.toCargoOne, row.commodityId, 'to-orbit', 'one');
        bind(row.toShipOne, row.commodityId, 'to-ship', 'one');
        bind(row.toShipMax, row.commodityId, 'to-ship', 'max');
    }
    const closeListener = (): void => port.close();
    close.addEventListener('click', closeListener);
    const renderCapacity = (element: HTMLElement, used: number, capacity: number, label: string): void => {
        const full = capacity > 0 && used >= capacity;
        const empty = used <= 0;
        const fill = required<HTMLElement>(element, '.cargo-transfer-capacity-fill');
        const state = required<HTMLElement>(element, '.cargo-transfer-capacity-state');
        const track = required<HTMLElement>(element, '.cargo-transfer-capacity-track');
        const percentage = capacity > 0 ? Math.min(100, Math.max(0, used / capacity * 100)) : 0;
        element.dataset.capacityState = full ? 'full' : empty ? 'empty' : 'normal';
        fill.style.width = `${percentage}%`;
        state.textContent = full ? 'FULL' : empty ? 'EMPTY' : '';
        track.setAttribute('aria-valuemin', '0');
        track.setAttribute('aria-valuemax', String(capacity));
        track.setAttribute('aria-valuenow', String(used));
        track.setAttribute('aria-label', `${label}: ${used} of ${capacity}`);
    };
    const render = (snapshot: Readonly<CargoTransferSnapshot>): void => {
        modal.hidden = !snapshot.visible;
        title.textContent = displayLabels.cargoTransferTitle;
        cargoHeader.textContent = displayLabels.cargoTransferCargoHeader;
        commodityHeader.textContent = displayLabels.cargoTransferCommodityHeader;
        shipHeader.textContent = displayLabels.cargoTransferShipHeader;
        cargoUsage.textContent = `${snapshot.cargoUsed}/${snapshot.cargoCapacity}`;
        shipUsage.textContent = `${snapshot.shipUsed}/${snapshot.shipCapacity}`;
        renderCapacity(cargoCapacity, snapshot.cargoUsed, snapshot.cargoCapacity, displayLabels.cargoTransferCargoHeader);
        renderCapacity(shipCapacity, snapshot.shipUsed, snapshot.shipCapacity, displayLabels.cargoTransferShipHeader);
        const cargoById = new Map(snapshot.rows.map(row => [row.commodityId, row]));
        const shipFull = snapshot.shipUsed >= snapshot.shipCapacity;
        const cargoFull = snapshot.cargoUsed >= snapshot.cargoCapacity;
        const noCargo = snapshot.cargoId === null;
        for (const row of rows) {
            const snapshotRow = cargoById.get(row.commodityId);
            row.section.hidden = snapshotRow === undefined;
            if (!snapshotRow) continue;
            row.cargoQuantity.textContent = String(snapshotRow.cargoQuantity);
            row.shipQuantity.textContent = String(snapshotRow.shipQuantity);
            const label = commodityLabel(row.commodityId);
            for (const icon of [row.cargoIcon, row.shipIcon]) {
                icon.className = 'cargo-transfer-row-icon cargo-commodity-icon commodity-icon';
                icon.dataset.commodityId = row.commodityId;
                icon.setAttribute('aria-hidden', 'true');
            }
            row.cargoIcon.hidden = snapshotRow.cargoQuantity <= 0;
            row.shipIcon.hidden = snapshotRow.shipQuantity <= 0;
            row.name.textContent = label;
            row.cargoQuantity.classList.toggle('is-zero', snapshotRow.cargoQuantity <= 0);
            row.shipQuantity.classList.toggle('is-zero', snapshotRow.shipQuantity <= 0);
            const canTransferToCargo = !noCargo && snapshotRow.shipQuantity > 0;
            const canTransferToShip = !noCargo && snapshotRow.cargoQuantity > 0;
            row.toCargoMax.hidden = !canTransferToCargo;
            row.toCargoOne.hidden = !canTransferToCargo;
            row.toShipOne.hidden = !canTransferToShip;
            row.toShipMax.hidden = !canTransferToShip;
            row.toCargoMax.disabled = !canTransferToCargo || cargoFull;
            row.toCargoOne.disabled = !canTransferToCargo || cargoFull;
            row.toShipOne.disabled = !canTransferToShip || shipFull;
            row.toShipMax.disabled = !canTransferToShip || shipFull;
        }
        warning.hidden = snapshot.warning === null;
        warning.textContent = snapshot.warning ?? '';
        close.textContent = displayLabels.cargoTransferConfirm;
    };
    const unsubscribe = port.subscribe(render);
    let destroyed = false;
    return {
        destroy: () => {
            if (destroyed) return;
            destroyed = true;
            unsubscribe();
            for (const { element, listener } of listeners) element.removeEventListener('click', listener);
            close.removeEventListener('click', closeListener);
            port.destroy();
        }
    };
}
