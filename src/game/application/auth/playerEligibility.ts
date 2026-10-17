import type { AuthPort } from './auth';
import type { PlayerProfile, PlayerProfilePort } from '../playerProfile';

export type PlayerEligibilityStatus = 'loading' | 'ready' | 'unsigned' | 'failed';

export interface PlayerEligibilitySnapshot
{
    readonly status: PlayerEligibilityStatus;
    readonly ownerId: string | null;
    readonly anonymous: boolean;
    readonly profile: Readonly<PlayerProfile> | null;
    readonly message: string | null;
}

export interface PlayerEligibilityPort
{
    getSnapshot(): Readonly<PlayerEligibilitySnapshot>;
    subscribe(listener: (snapshot: Readonly<PlayerEligibilitySnapshot>) => void): () => void;
    retry(): void;
    destroy(): void;
}

/** Shares profile creation and owner-scoped readiness between account UI and save services. */
export function createPlayerEligibility (auth: AuthPort, profile: PlayerProfilePort | null, generateNickname: () => string): PlayerEligibilityPort
{
    const listeners = new Set<(snapshot: Readonly<PlayerEligibilitySnapshot>) => void>();
    let authSnapshot = auth.getSnapshot();
    let operation = 0;
    let destroyed = false;
    let snapshot: Readonly<PlayerEligibilitySnapshot> = Object.freeze({ status: 'unsigned', ownerId: null, anonymous: false, profile: null, message: null });
    const publish = (next: PlayerEligibilitySnapshot): void => {
        if (destroyed) return;
        snapshot = Object.freeze(next);
        for (const listener of listeners) listener(snapshot);
    };
    const resolve = (): void => {
        const current = authSnapshot;
        const currentOperation = ++operation;
        if (current.status === 'loading') {
            publish({ status: 'loading', ownerId: null, anonymous: false, profile: null, message: null });
            return;
        }
        if (current.status === 'error') {
            publish({ status: 'failed', ownerId: null, anonymous: false, profile: null, message: current.message });
            return;
        }
        if (current.status !== 'signed-in' || current.ownerId === null || current.anonymous) {
            publish({ status: 'unsigned', ownerId: current.ownerId, anonymous: current.anonymous, profile: null, message: null });
            return;
        }
        if (!profile) {
            publish({ status: 'failed', ownerId: current.ownerId, anonymous: false, profile: null, message: 'Player profile service is unavailable.' });
            return;
        }
        publish({ status: 'loading', ownerId: current.ownerId, anonymous: false, profile: null, message: null });
        void profile.loadOrCreate(generateNickname(), current.ownerId).then(value => {
            if (currentOperation !== operation || authSnapshot.ownerId !== current.ownerId || authSnapshot.status !== 'signed-in' || authSnapshot.anonymous) return;
            publish({ status: 'ready', ownerId: current.ownerId, anonymous: false, profile: value, message: null });
        }).catch(error => {
            if (currentOperation !== operation || authSnapshot.ownerId !== current.ownerId || authSnapshot.status !== 'signed-in' || authSnapshot.anonymous) return;
            publish({ status: 'failed', ownerId: current.ownerId, anonymous: false, profile: null, message: error instanceof Error ? error.message : 'Player profile could not be loaded.' });
        });
    };
    const unsubscribe = auth.subscribe(next => {
        const ownerChanged = next.ownerId !== authSnapshot.ownerId || next.status !== authSnapshot.status || next.anonymous !== authSnapshot.anonymous;
        authSnapshot = next;
        if (ownerChanged) resolve();
    });
    resolve();
    return {
        getSnapshot: () => snapshot,
        subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
        retry: resolve,
        destroy: () => { if (destroyed) return; destroyed = true; operation++; unsubscribe(); listeners.clear(); }
    };
}

