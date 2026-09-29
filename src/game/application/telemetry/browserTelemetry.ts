import type { AuthPort } from '../auth/auth';
import { browserAuthConfiguration, gameVersion } from '../auth/configuration';
import { createTelemetryPort, type TelemetryPlatform, type TelemetryPort } from './telemetry';

export function createBrowserTelemetryPort (auth: AuthPort): TelemetryPort
{
    const configuration = browserAuthConfiguration();
    const endpoint = telemetryEndpoint(configuration.url);
    return createTelemetryPort({
        endpoint,
        gameVersion,
        auth,
        storage: window.localStorage,
        uuid: () => crypto.randomUUID(),
        now: () => Date.now(),
        fetch: window.fetch.bind(window),
        platform: browserPlatform()
    });
}

function telemetryEndpoint (url: string | undefined): string | null
{
    if (!url) return null;
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') return null;
        return new URL('/functions/v1/ingest-game-events', parsed).toString();
    } catch {
        return null;
    }
}

function browserPlatform (): TelemetryPlatform
{
    return window.matchMedia('(pointer: coarse)').matches ? 'mobile' : 'desktop';
}
