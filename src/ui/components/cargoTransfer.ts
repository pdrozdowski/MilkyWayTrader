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
    readonly icon: HTMLElement;
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
            icon: required<HTMLElement>(section, '.cargo-transfer-row-icon'),
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
    const render = (snapshot: Readonly<CargoTransferSnapshot>): void => {
        modal.hidden = !snapshot.visible;
        title.textContent = displayLabels.cargoTransferTitle;
        cargoHeader.textContent = displayLabels.cargoTransferCargoHeader;
        commodityHeader.textContent = displayLabels.cargoTransferCommodityHeader;
        shipHeader.textContent = displayLabels.cargoTransferShipHeader;
        cargoUsage.textContent = `${snapshot.cargoUsed}/${snapshot.cargoCapacity}`;
        shipUsage.textContent = `${snapshot.shipUsed}/${snapshot.shipCapacity}`;
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
            row.icon.textContent = label.slice(0, 1);
            row.icon.setAttribute('aria-label', `${label} commodity icon`);
            row.name.textContent = label;
            row.toCargoMax.textContent = displayLabels.toCargoMax;
            row.toCargoOne.textContent = displayLabels.toCargoOne;
            row.toShipOne.textContent = displayLabels.toShipOne;
            row.toShipMax.textContent = displayLabels.toShipMax;
            row.toCargoMax.disabled = noCargo || snapshotRow.shipQuantity === 0 || cargoFull;
            row.toCargoOne.disabled = noCargo || snapshotRow.shipQuantity === 0 || cargoFull;
            row.toShipOne.disabled = noCargo || snapshotRow.cargoQuantity === 0 || shipFull;
            row.toShipMax.disabled = noCargo || snapshotRow.cargoQuantity === 0 || shipFull;
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
