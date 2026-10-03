import type { AuthPort, AuthSnapshot, UiHandle } from '../contracts';
import { displayLabels } from './displayLabels';

function required<T extends Element> (root: HTMLElement, selector: string): T
{
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing auth control: ${selector}`);
    return element;
}

export function mountAuthControls (root: HTMLElement, port: AuthPort, beforeSignIn: () => void = () => {}): UiHandle
{
    const signIn = required<HTMLButtonElement>(root, '#main-menu-sign-in-preview');
    const signInLabel = required<HTMLElement>(signIn, '.main-menu-sign-in-preview-label');
    const status = required<HTMLElement>(root, '#run-status-auth');
    let currentSnapshot = port.getSnapshot();
    const render = (snapshot: Readonly<AuthSnapshot>): void => {
        currentSnapshot = snapshot;
        const unavailable = snapshot.status === 'unavailable';
        const signedIn = snapshot.status === 'signed-in';
        signIn.disabled = unavailable;
        signIn.title = unavailable ? displayLabels.authUnavailable : '';
        signInLabel.textContent = signedIn ? snapshot.email ?? displayLabels.unsigned : 'Sign In';
        status.textContent = signedIn ? snapshot.email ?? displayLabels.unsigned : snapshot.status === 'error' ? displayLabels.authError : displayLabels.unsigned;
        status.classList.toggle('run-status-auth--signed-in', signedIn);
        status.title = unavailable ? displayLabels.authUnavailable : snapshot.message ?? '';
    };
    const signInClick = (): void => {
        if (currentSnapshot.status === 'signed-in') void port.signOut();
        else {
            beforeSignIn();
            void port.signInWithGoogle();
        }
    };
    signIn.addEventListener('click', signInClick);
    const unsubscribe = port.subscribe(render);
    render(currentSnapshot);
    let destroyed = false;
    return { destroy: () => { if (destroyed) return; destroyed = true; unsubscribe(); signIn.removeEventListener('click', signInClick); } };
}
