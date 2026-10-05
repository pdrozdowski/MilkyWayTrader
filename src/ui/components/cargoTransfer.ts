import type { CargoTransferPort, CargoTransferSnapshot, UiHandle } from '../contracts';
import { displayLabels } from './displayLabels';

function required<T extends Element> (root: HTMLElement, selector: string): T
{
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing cargo transfer control: ${selector}`);
    return element;
}

const average = (container: CargoTransferSnapshot['cargo']): string => container && container.quantity > 0 ? (container.totalCost / container.quantity).toFixed(2) : '0.00';

export function mountCargoTransfer (root: HTMLElement, port: CargoTransferPort): UiHandle
{
    const modal = required<HTMLElement>(root, '#cargo-transfer');
    const cargo = required<HTMLElement>(root, '#cargo-transfer-cargo');
    const ship = required<HTMLElement>(root, '#cargo-transfer-ship');
    const warning = required<HTMLElement>(root, '#cargo-transfer-warning');
    const toShip = required<HTMLButtonElement>(root, '#cargo-transfer-to-ship');
    const toCargo = required<HTMLButtonElement>(root, '#cargo-transfer-to-cargo');
    const close = required<HTMLButtonElement>(root, '#cargo-transfer-close');
    const render = (snapshot: Readonly<CargoTransferSnapshot>): void => {
        modal.hidden = !snapshot.visible;
        cargo.textContent = `${displayLabels.orbitalCargo}: ${snapshot.cargo?.quantity ?? 0} · ${displayLabels.averageBuyPrice}: ${average(snapshot.cargo)}`;
        ship.textContent = `${displayLabels.shipCargo}: ${snapshot.ship?.quantity ?? 0} · ${displayLabels.averageBuyPrice}: ${average(snapshot.ship)} (${snapshot.cargoUsed} / ${snapshot.cargoCapacity})`;
        toShip.textContent = displayLabels.transferToShip;
        toCargo.textContent = displayLabels.transferToCargo;
        close.textContent = displayLabels.close;
        toShip.disabled = !snapshot.cargo || snapshot.cargo.quantity === 0 || snapshot.cargoUsed >= snapshot.cargoCapacity;
        toCargo.disabled = !snapshot.cargo || !snapshot.ship || snapshot.ship.quantity === 0;
        warning.hidden = snapshot.warning === null;
        warning.textContent = snapshot.warning ?? '';
    };
    const unsubscribe = port.subscribe(render);
    toShip.addEventListener('click', port.transferToShip);
    toCargo.addEventListener('click', port.transferToCargo);
    close.addEventListener('click', port.close);
    return { destroy: () => { unsubscribe(); toShip.removeEventListener('click', port.transferToShip); toCargo.removeEventListener('click', port.transferToCargo); close.removeEventListener('click', port.close); port.destroy(); } };
}
