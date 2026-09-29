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
    const render = (snapshot: Readonly<AuthSnapshot>): void => {
        const unavailable = snapshot.status === 'unavailable';
        signIn.disabled = unavailable;
        signIn.title = unavailable ? displayLabels.authUnavailable : '';
        signIn.textContent = displayLabels.signInWithGoogle;
        signOut.hidden = snapshot.status !== 'signed-in';
        signOut.textContent = displayLabels.signOut;
        status.textContent = snapshot.status === 'signed-in' ? snapshot.email ?? displayLabels.unsigned : snapshot.status === 'error' ? displayLabels.authError : displayLabels.unsigned;
        status.title = unavailable ? displayLabels.authUnavailable : snapshot.message ?? '';
    };
    const signInClick = (): void => { void port.signInWithGoogle(); };
    const signOutClick = (): void => { void port.signOut(); };
    signIn.addEventListener('click', signInClick);
    signOut.addEventListener('click', signOutClick);
    const unsubscribe = port.subscribe(render);
    render(port.getSnapshot());
    let destroyed = false;
    return { destroy: () => { if (destroyed) return; destroyed = true; unsubscribe(); signIn.removeEventListener('click', signInClick); signOut.removeEventListener('click', signOutClick); } };
}
