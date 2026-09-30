import { expect, test } from '@playwright/test';
import { createTelemetryPort, type TelemetryDependencies, type TelemetryEvent } from '../../src/game/application/telemetry/telemetry';
import type { AuthPort } from '../../src/game/application/auth/auth';
import { GameStateProvider } from '../../src/game/application/gameStateProvider';
import { initialGameState } from '../../src/game/definitions/initialGameState';
import { createLandingStatusPort } from '../../src/ui/adapters/landingStatusAdapter';
import type { Game } from 'phaser';

function dependencies (overrides: Partial<TelemetryDependencies> = {}): TelemetryDependencies
{
    let nextId = 0;
    return {
        endpoint: 'https://project.supabase.co/functions/v1/ingest-game-events',
        publishableKey: 'sb_publishable_test',
        gameVersion: 'test-version',
        auth: unsignedAuth(),
        storage: memoryStorage(),
        uuid: () => `00000000-0000-4000-8000-${String(++nextId).padStart(12, '0')}`,
        now: () => 1_000,
        fetch: async () => new Response(null, { status: 202 }),
        platform: 'desktop',
        ...overrides
    };
}

function unsignedAuth (getAccessToken: () => Promise<string | null> = async () => null): AuthPort
{
    return {
        getSnapshot: () => ({ status: 'unsigned', email: null, message: null }),
        subscribe: () => () => {},
        signInWithGoogle: async () => {},
        signOut: async () => {},
        getAccessToken,
        destroy: () => {}
    };
}

function memoryStorage (): Pick<Storage, 'getItem' | 'setItem'>
{
    const entries = new Map<string, string>();
    return { getItem: key => entries.get(key) ?? null, setItem: (key, value) => { entries.set(key, value); } };
}

function eventsFrom (calls: RequestInit[]): TelemetryEvent[]
{
    return calls.flatMap(call => (JSON.parse(String(call.body)) as { events: TelemetryEvent[] }).events);
}

test('telemetry reuses one installation ID, creates one fresh session ID per run, and freezes event data', async () => {
    const storage = memoryStorage();
    const requests: RequestInit[] = [];
    const fetch: typeof window.fetch = async (_input, init) => {
        requests.push(init ?? {});
        return new Response(null, { status: 202 });
    };
    const first = createTelemetryPort(dependencies({ storage, fetch }));
    const payload = { planet: 'seroton', nested: { amount: 2 } };
    first.startSession(100_000);
    first.emit('planet_landed', payload);
    payload.nested.amount = 99;
    await expect.poll(() => eventsFrom(requests).length).toBe(2);

    const second = createTelemetryPort(dependencies({ storage, fetch }));
    second.startSession(50_000);
    await expect.poll(() => eventsFrom(requests).length).toBe(3);
    const [started, landed, restarted] = eventsFrom(requests);
    expect(started.anonymous_id).toBe(landed.anonymous_id);
    expect(started.anonymous_id).toBe(restarted.anonymous_id);
    expect(started.session_id).not.toBe(restarted.session_id);
    expect(landed.event_data).toEqual({ planet: 'seroton', nested: { amount: 2 } });
});

test('telemetry reads the current auth token per batch without sending a client user ID', async () => {
    let token: string | null = null;
    const requests: RequestInit[] = [];
    const telemetry = createTelemetryPort(dependencies({
        auth: unsignedAuth(async () => token),
        fetch: async (_input, init) => {
            requests.push(init ?? {});
            return new Response(null, { status: 202 });
        }
    }));
    telemetry.startSession(100_000);
    await expect.poll(() => requests.length).toBe(1);
    token = 'later-sign-in-token';
    telemetry.emit('planet_landed', { planet: 'seroton', credits_after: 100_000 });
    await expect.poll(() => requests.length).toBe(2);

    expect(requests[0].headers).not.toHaveProperty('authorization');
    expect(requests[1].headers).toMatchObject({ authorization: 'Bearer later-sign-in-token' });
    for (const event of eventsFrom(requests)) expect(event).not.toHaveProperty('user_id');
});

test('telemetry bounds pending events, drops failed delivery, and teardown prevents later work', async () => {
    const requests: RequestInit[] = [];
    let resolveFirst: () => void = () => { throw new Error('First telemetry request did not start.'); };
    const firstRequest = new Promise<Response>(resolve => { resolveFirst = () => resolve(new Response(null, { status: 202 })); });
    const telemetry = createTelemetryPort(dependencies({
        fetch: async (_input, init) => {
            requests.push(init ?? {});
            return requests.length === 1 ? firstRequest : new Response(null, { status: 202 });
        }
    }));
    telemetry.startSession(100_000);
    for (let index = 0; index < 25; index++) telemetry.emit('planet_landed', { index });
    await expect.poll(() => requests.length).toBe(1);
    resolveFirst();
    await expect.poll(() => requests.length).toBe(2);
    expect(eventsFrom(requests)).toHaveLength(21);

    const failedRequests: RequestInit[] = [];
    const failed = createTelemetryPort(dependencies({ fetch: async (_input, init) => {
        failedRequests.push(init ?? {});
        throw new Error('offline');
    } }));
    failed.startSession(100_000);
    await expect.poll(() => failedRequests.length).toBe(1);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(failedRequests).toHaveLength(1);

    telemetry.destroy();
    telemetry.emit('planet_landed', { ignored: true });
    telemetry.startSession(50_000);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(eventsFrom(requests)).toHaveLength(21);
});

test('market telemetry records each successful trade and launch once, never no-op actions', () => {
    const provider = new GameStateProvider({
        ...initialGameState,
        clock: { ...initialGameState.clock, pauseReasons: ['landed'] },
        planetLifecycle: { ...initialGameState.planetLifecycle, capturedPlanetId: 'seroton', landedPlanetId: 'seroton' }
    });
    const emitted: Array<{ name: string; data: Readonly<Record<string, unknown>> }> = [];
    const telemetry = {
        startSession: () => {}, endSession: () => {},
        emit: (name: string, data: Readonly<Record<string, unknown>>) => { emitted.push({ name, data }); },
        destroy: () => {}
    };
    const game = {
        registry: { get: (key: string) => key === 'gameStateProvider' ? provider : telemetry },
        events: { emit: () => {} }
    } as unknown as Game;
    const landing = createLandingStatusPort(game);

    landing.confirmTrade();
    expect(emitted).toEqual([]);
    landing.setTradeQuantity(1);
    landing.confirmTrade();
    landing.confirmTrade();
    landing.launch();
    landing.launch();

    expect(emitted).toHaveLength(2);
    expect(emitted[0]).toMatchObject({ name: 'commodity_bought', data: { planet: 'seroton', commodity: 'supplies', quantity: 1 } });
    expect(emitted[1]).toMatchObject({ name: 'planet_launched', data: { planet: 'seroton' } });
    landing.destroy();
});
