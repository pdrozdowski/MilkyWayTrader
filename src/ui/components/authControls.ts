import type { AuthPort, AuthSnapshot, UiHandle } from '../contracts';
import { displayLabels } from './displayLabels';

function required<T extends Element> (root: HTMLElement, selector: string): T
{
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing auth control: ${selector}`);
    return element;
}

export function mountAuthControls (root: HTMLElement, port: AuthPort): UiHandle
{
    const signIn = required<HTMLButtonElement>(root, '#main-menu-sign-in');
    const signOut = required<HTMLButtonElement>(root, '#game-menu-sign-out');
    const status = required<HTMLElement>(root, '#run-status-auth');
    let currentSnapshot = port.getSnapshot();
    const render = (snapshot: Readonly<AuthSnapshot>): void => {
        currentSnapshot = snapshot;
        const unavailable = snapshot.status === 'unavailable';
        const signedIn = snapshot.status === 'signed-in';
        signIn.disabled = unavailable;
        signIn.title = unavailable ? displayLabels.authUnavailable : '';
        if (signedIn) {
            const icon = document.createElement('span');
            icon.className = 'main-menu-user-icon';
            icon.setAttribute('aria-hidden', 'true');
            signIn.replaceChildren(icon, document.createTextNode(` ${snapshot.email ?? displayLabels.unsigned} \u00b7 ${displayLabels.signOut}`));
        } else signIn.textContent = displayLabels.signInWithGoogle;
        signIn.classList.toggle('main-menu-sign-in--signed-in', signedIn);
        signOut.hidden = !signedIn;
        signOut.textContent = displayLabels.signOut;
        status.textContent = signedIn ? snapshot.email ?? displayLabels.unsigned : snapshot.status === 'error' ? displayLabels.authError : displayLabels.unsigned;
        status.classList.toggle('run-status-auth--signed-in', signedIn);
        status.title = unavailable ? displayLabels.authUnavailable : snapshot.message ?? '';
    };
    const signInClick = (): void => { void (currentSnapshot.status === 'signed-in' ? port.signOut() : port.signInWithGoogle()); };
    const signOutClick = (): void => { void port.signOut(); };
    signIn.addEventListener('click', signInClick);
    signOut.addEventListener('click', signOutClick);
    const unsubscribe = port.subscribe(render);
    render(currentSnapshot);
    let destroyed = false;
    return { destroy: () => { if (destroyed) return; destroyed = true; unsubscribe(); signIn.removeEventListener('click', signInClick); signOut.removeEventListener('click', signOutClick); } };
}
