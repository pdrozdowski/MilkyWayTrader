import type { RunStatusPort, RunStatusSnapshot, UiHandle } from '../contracts';
import { displayLabels } from './displayLabels';

function required<T extends Element> (root: HTMLElement, selector: string): T
{
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing run status control: ${selector}`);
    return element;
}

function clock (seconds: number): string
{
    return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

function commodityLabel (commodityId: string): string
{
    const knownLabel = displayLabels[commodityId as keyof typeof displayLabels];
    return typeof knownLabel === 'string' ? knownLabel : `${commodityId.slice(0, 1).toUpperCase()}${commodityId.slice(1)}`;
}

export function mountRunStatus (root: HTMLElement, port: RunStatusPort): UiHandle
{
    const toolbar = required<HTMLElement>(root, '#run-status');
    const values = ['#run-status-clock', '#run-status-credits', '#run-status-cargo', '#run-status-hp-label', '#run-status-cargo-contents', '#run-status-cargo-system', '#run-status-engine-system', '#run-status-weapon-system', '#run-status-booster'].map(selector => required<HTMLElement>(root, selector));
    const [time, credits, cargo, hp, contents, cargoSystem, engineSystem, weaponSystem, booster] = values;
    const cargoRows = required<HTMLTableSectionElement>(root, '#run-status-cargo-rows');
    const bar = required<HTMLProgressElement>(root, '#run-status-hp');
    const shipButton = required<HTMLButtonElement>(root, '#run-status-ship-toggle');
    const cargoButton = required<HTMLButtonElement>(root, '#run-status-cargo-toggle');
    const shipDetails = required<HTMLElement>(root, '#run-status-ship-details');
    const cargoDetails = required<HTMLElement>(root, '#run-status-cargo-details');
    let shipOpen = false;
    let cargoOpen = false;
    const details = (): void => {
        shipButton.setAttribute('aria-expanded', String(shipOpen)); shipDetails.hidden = !shipOpen;
        cargoButton.setAttribute('aria-expanded', String(cargoOpen)); cargoDetails.hidden = !cargoOpen;
    };
    const render = (snapshot: Readonly<RunStatusSnapshot>): void => {
        toolbar.hidden = !snapshot.visible;
        time.textContent = `${clock(snapshot.remainingSeconds)} · ${snapshot.runState}`;
        credits.textContent = `${snapshot.credits.toLocaleString('en-US')} cr`;
        cargo.textContent = `Cargo ${snapshot.cargoUsed} / ${snapshot.cargoCapacity}`;
        hp.textContent = `HP ${snapshot.currentHitPoints} / ${snapshot.maximumHitPoints}`;
        bar.value = snapshot.currentHitPoints; bar.max = snapshot.maximumHitPoints;
        contents.textContent = 'Cargo contents:';
        cargoRows.replaceChildren(...snapshot.cargo.map(stack => {
            const row = document.createElement('tr');
            const icon = document.createElement('span');
            icon.className = 'cargo-commodity-icon';
            icon.dataset.commodityId = stack.commodityId;
            icon.style.width = '32px';
            icon.style.height = '32px';
            icon.setAttribute('aria-hidden', 'true');
            icon.textContent = commodityLabel(stack.commodityId).slice(0, 1);
            const iconCell = document.createElement('td');
            iconCell.append(icon);
            const name = document.createElement('td');
            name.textContent = commodityLabel(stack.commodityId);
            const quantity = document.createElement('td');
            quantity.textContent = String(stack.quantity);
            row.append(iconCell, name, quantity);
            return row;
        }));
        cargoSystem.textContent = `Cargo: Level ${snapshot.cargoSystem.level} · ${snapshot.cargoSystem.available ? 'Available' : 'Unavailable'}`;
        engineSystem.textContent = `Engine: Level ${snapshot.engineSystem.level} · ${snapshot.engineSystem.available ? 'Available' : 'Unavailable'}`;
        weaponSystem.textContent = `Weapon: Level ${snapshot.weaponSystem.level} · ${snapshot.weaponSystem.available ? 'Available' : 'Unavailable'}`;
        booster.textContent = `Booster: ${snapshot.boosterAvailable ? 'Available' : 'Locked'}`;
    };
    const toggleShip = (): void => { shipOpen = !shipOpen; details(); };
    const toggleCargo = (): void => { cargoOpen = !cargoOpen; details(); };
    const unsubscribe = port.subscribe(render);
    shipButton.addEventListener('click', toggleShip); cargoButton.addEventListener('click', toggleCargo); details();
    let destroyed = false;
    return { destroy: () => {
        if (destroyed) return;
        destroyed = true; unsubscribe(); shipButton.removeEventListener('click', toggleShip); cargoButton.removeEventListener('click', toggleCargo); port.destroy();
    } };
}
