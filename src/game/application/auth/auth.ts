import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { browserAuthConfiguration } from './configuration';

export type AuthStatus = 'unavailable' | 'unsigned' | 'signed-in' | 'error';

export interface AuthSnapshot
{
    status: AuthStatus;
    email: string | null;
    message: string | null;
}

export interface AuthPort
{
    getSnapshot(): Readonly<AuthSnapshot>;
    subscribe(listener: (snapshot: Readonly<AuthSnapshot>) => void): () => void;
    signInWithGoogle(): Promise<void>;
    signOut(): Promise<void>;
    destroy(): void;
}

export interface PublicAuthConfiguration
{
    url?: string;
    publishableKey?: string;
}

type ClientFactory = (url: string, key: string) => SupabaseClient;

const unavailableSnapshot: AuthSnapshot = Object.freeze({
    status: 'unavailable', email: null, message: 'Sign-in is unavailable: configure Supabase public URL and publishable key.'
});

function isValidConfiguration (configuration: PublicAuthConfiguration): configuration is Required<PublicAuthConfiguration>
{
    if (!configuration.url || !configuration.publishableKey || /\s/.test(configuration.publishableKey) || configuration.publishableKey.length < 20) return false;
    try {
        const url = new URL(configuration.url);
        return url.protocol === 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    } catch {
        return false;
    }
}

function toSnapshot (email: string | undefined): AuthSnapshot
{
    return Object.freeze(email ? { status: 'signed-in', email, message: null } : { status: 'unsigned', email: null, message: null });
}

export function createAuthPort (configuration: PublicAuthConfiguration, clientFactory: ClientFactory = createClient): AuthPort
{
    if (!isValidConfiguration(configuration)) return createUnavailableAuthPort();
    const client = clientFactory(configuration.url, configuration.publishableKey);
    const listeners = new Set<(snapshot: Readonly<AuthSnapshot>) => void>();
    let snapshot: Readonly<AuthSnapshot> = toSnapshot(undefined);
    let destroyed = false;
    const publish = (next: AuthSnapshot): void => {
        if (destroyed) return;
        snapshot = next;
        for (const listener of listeners) listener(snapshot);
    };
    const setSession = (session: { user: { email?: string | null } } | null): void => publish(toSnapshot(session?.user.email ?? undefined));
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => setSession(session));
    void client.auth.getSession().then(({ data, error }) => {
        if (error) publish(Object.freeze({ status: 'error', email: null, message: error.message }));
        else setSession(data.session);
    }).catch(error => publish(Object.freeze({ status: 'error', email: null, message: error instanceof Error ? error.message : 'Unable to read sign-in status.' })));
    return {
        getSnapshot: () => snapshot,
        subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
        signInWithGoogle: async () => {
            if (destroyed) return;
            const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
            if (error) publish(Object.freeze({ status: 'error', email: null, message: error.message }));
        },
        signOut: async () => {
            if (destroyed) return;
            const { error } = await client.auth.signOut({ scope: 'local' });
            if (error) publish(Object.freeze({ status: 'error', email: null, message: error.message }));
            else publish(toSnapshot(undefined));
        },
        destroy: () => {
            if (destroyed) return;
            destroyed = true;
            listener.subscription.unsubscribe();
            listeners.clear();
        }
    };
}

export function createBrowserAuthPort (): AuthPort
{
    return createAuthPort(browserAuthConfiguration());
}

function createUnavailableAuthPort (): AuthPort
{
    return { getSnapshot: () => unavailableSnapshot, subscribe: () => () => {}, signInWithGoogle: async () => {}, signOut: async () => {}, destroy: () => {} };
}
