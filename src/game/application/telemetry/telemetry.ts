import type { AuthPort } from '../auth/auth';

export type TelemetryPlatform = 'desktop' | 'mobile';
export type TelemetryEventName = 'session_started' | 'session_ended' | 'planet_landed' | 'planet_launched' | 'commodity_bought' | 'commodity_sold';

export interface TelemetryEvent
{
    readonly anonymous_id: string;
    readonly session_id: string;
    readonly event_name: TelemetryEventName;
    readonly event_data: Readonly<Record<string, unknown>>;
    readonly game_version: string;
    readonly platform: TelemetryPlatform;
}

export interface TelemetryPort
{
    startSession(startingCredits: number): void;
    endSession(finalCredits: number): void;
    emit(eventName: Exclude<TelemetryEventName, 'session_started' | 'session_ended'>, eventData: Readonly<Record<string, unknown>>): void;
    destroy(): void;
}

export interface TelemetryDependencies
{
    readonly endpoint: string | null;
    readonly gameVersion: string;
    readonly auth: AuthPort;
    readonly storage: Pick<Storage, 'getItem' | 'setItem'>;
    readonly uuid: () => string;
    readonly now: () => number;
    readonly fetch: typeof window.fetch;
    readonly platform: TelemetryPlatform;
}

const anonymousIdStorageKey = 'milky-way-trader:anonymous_id';
const queueCapacity = 20;

export function createTelemetryPort (dependencies: TelemetryDependencies): TelemetryPort
{
    const anonymousId = storedAnonymousId(dependencies.storage, dependencies.uuid);
    const queue: TelemetryEvent[] = [];
    let sessionId: string | null = null;
    let sessionStartedAt: number | null = null;
    let flushing = false;
    let destroyed = false;
    const enqueue = (eventName: TelemetryEventName, eventData: Readonly<Record<string, unknown>>): void => {
        if (destroyed || !sessionId || queue.length >= queueCapacity) return;
        queue.push(Object.freeze({
            anonymous_id: anonymousId,
            session_id: sessionId,
            event_name: eventName,
            event_data: immutableData(eventData),
            game_version: dependencies.gameVersion,
            platform: dependencies.platform
        }));
        void flush();
    };
    const flush = async (): Promise<void> => {
        if (flushing || destroyed || !dependencies.endpoint || queue.length === 0) return;
        flushing = true;
        const batch = queue.splice(0, queue.length);
        try {
            const accessToken = await dependencies.auth.getAccessToken?.() ?? null;
            const headers: Record<string, string> = { 'content-type': 'application/json' };
            if (accessToken) headers.authorization = `Bearer ${accessToken}`;
            await dependencies.fetch(dependencies.endpoint, { method: 'POST', headers, body: JSON.stringify({ events: batch }) });
        } catch {
            // Telemetry is best-effort: failures are intentionally dropped.
        } finally {
            flushing = false;
            if (!destroyed && queue.length > 0) void flush();
        }
    };
    return {
        startSession: startingCredits => {
            if (destroyed) return;
            sessionId = dependencies.uuid();
            sessionStartedAt = dependencies.now();
            enqueue('session_started', { session_started_at: new Date(sessionStartedAt).toISOString(), starting_credits: startingCredits });
        },
        endSession: finalCredits => {
            if (destroyed || !sessionId || sessionStartedAt === null) return;
            enqueue('session_ended', { duration_ms: Math.max(0, dependencies.now() - sessionStartedAt), final_credits: finalCredits });
            sessionId = null;
            sessionStartedAt = null;
        },
        emit: (eventName, eventData) => enqueue(eventName, eventData),
        destroy: () => { destroyed = true; queue.length = 0; }
    };
}

function storedAnonymousId (storage: Pick<Storage, 'getItem' | 'setItem'>, uuid: () => string): string
{
    const existing = storage.getItem(anonymousIdStorageKey);
    if (existing) return existing;
    const anonymousId = uuid();
    try { storage.setItem(anonymousIdStorageKey, anonymousId); } catch { /* Storage may be unavailable in private browsing. */ }
    return anonymousId;
}

function immutableData (eventData: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>>
{
    return Object.freeze(JSON.parse(JSON.stringify(eventData)) as Record<string, unknown>);
}
