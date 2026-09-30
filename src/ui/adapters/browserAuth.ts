import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AuthPort, AuthSnapshot } from '../../game/application/auth/auth';
import { browserAuthConfiguration, type PublicAuthConfiguration } from '../../game/application/auth/configuration';

const authOptions = {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'implicit' as const
};

type ClientFactory = (url: string, key: string, options: { auth: typeof authOptions }) => SupabaseClient;

const unavailableSnapshot: Readonly<AuthSnapshot> = Object.freeze({
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

function toSnapshot (email: string | undefined): Readonly<AuthSnapshot>
{
    return Object.freeze(email ? { status: 'signed-in', email, message: null } : { status: 'unsigned', email: null, message: null });
}

export function createBrowserAuthPort (configuration = browserAuthConfiguration(), clientFactory: ClientFactory = createClient): AuthPort
{
    if (!isValidConfiguration(configuration)) return createUnavailableAuthPort();
    const callbackUrl = new URL(window.location.href);
    console.debug('[AUTH DEBUG] creating Supabase client', {
        supabaseOrigin: new URL(configuration.url).origin,
        ...authOptions
    });
    console.debug('[AUTH DEBUG] inspecting OAuth callback URL', {
        pageUrl: `${callbackUrl.origin}${callbackUrl.pathname}`,
        hasOAuthCode: callbackUrl.searchParams.has('code'),
        hasOAuthError: callbackUrl.searchParams.has('error'),
        hasOAuthErrorDescription: callbackUrl.searchParams.has('error_description'),
        hasFragment: callbackUrl.hash.length > 0
    });
    console.debug('[AUTH DEBUG] PKCE callback exchange', {
        pkceUsed: false,
        automaticExchange: false,
        explicitExchange: false
    });
    const client = clientFactory(configuration.url, configuration.publishableKey, { auth: authOptions });
    const listeners = new Set<(snapshot: Readonly<AuthSnapshot>) => void>();
    let snapshot: Readonly<AuthSnapshot> = toSnapshot(undefined);
    let destroyed = false;
    const publish = (next: Readonly<AuthSnapshot>): void => {
        if (destroyed) return;
        snapshot = next;
        for (const listener of listeners) listener(snapshot);
    };
    const setSession = (session: { user: { email?: string | null } } | null): void => publish(toSnapshot(session?.user.email ?? undefined));
    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
        console.debug('[AUTH DEBUG] auth state changed', {
            event,
            hasSession: session !== null,
            userId: session?.user.id ?? null,
            email: session?.user.email ?? null
        });
        setSession(session);
    });
    void client.auth.getSession().then(async ({ data, error }) => {
        console.debug('[AUTH DEBUG] getSession completed', {
            hasSession: data.session !== null,
            userId: data.session?.user.id ?? null,
            email: data.session?.user.email ?? null,
            hasError: error !== null,
            errorMessage: error?.message ?? null
        });
        if (error) {
            publish(Object.freeze({ status: 'error', email: null, message: error.message }));
            return;
        }
        setSession(data.session);
        console.debug('[AUTH DEBUG] before getUser', { hasSession: data.session !== null, hasAccessToken: Boolean(data.session?.access_token) });
        const userResult = await client.auth.getUser();
        console.debug('[AUTH DEBUG] getUser completed', {
            hasUser: userResult.data.user !== null,
            userId: userResult.data.user?.id ?? null,
            email: userResult.data.user?.email ?? null,
            hasError: userResult.error !== null,
            errorMessage: userResult.error?.message ?? null,
            errorCode: userResult.error?.code ?? null
        });
    }).catch(error => {
        console.debug('[AUTH DEBUG] startup auth inspection failed', {
            errorMessage: error instanceof Error ? error.message : 'Unable to read sign-in status.'
        });
        publish(Object.freeze({ status: 'error', email: null, message: error instanceof Error ? error.message : 'Unable to read sign-in status.' }));
    });
    return {
        getSnapshot: () => snapshot,
        subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
        signInWithGoogle: async () => {
            if (destroyed) return;
            const redirectTo = window.location.origin;
            console.debug('[AUTH DEBUG] Google sign-in initiated', { redirectTo });
            const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
            if (error) publish(Object.freeze({ status: 'error', email: null, message: error.message }));
        },
        signOut: async () => {
            if (destroyed) return;
            const { error } = await client.auth.signOut({ scope: 'local' });
            if (error) publish(Object.freeze({ status: 'error', email: null, message: error.message }));
            else publish(toSnapshot(undefined));
        },
        getAccessToken: async () => {
            if (destroyed) return null;
            const { data, error } = await client.auth.getSession();
            return error ? null : data.session?.access_token ?? null;
        },
        destroy: () => {
            if (destroyed) return;
            destroyed = true;
            listener.subscription.unsubscribe();
            listeners.clear();
        }
    };
}

function createUnavailableAuthPort (): AuthPort
{
    return { getSnapshot: () => unavailableSnapshot, subscribe: () => () => {}, signInWithGoogle: async () => {}, signOut: async () => {}, destroy: () => {} };
}
