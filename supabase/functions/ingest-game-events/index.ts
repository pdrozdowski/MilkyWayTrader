import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2';

const allowedEventNames = new Set([
    'session_started',
    'session_ended',
    'planet_landed',
    'planet_launched',
    'commodity_bought',
    'commodity_sold'
]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maxBatchSize = 20;
const maxEventDataBytes = 4096;
const maxGameVersionLength = 64;

interface IncomingEvent
{
    anonymous_id: string;
    session_id: string;
    event_name: string;
    event_data: Record<string, unknown>;
    game_version: string;
    platform: 'desktop' | 'mobile';
}

interface RejectedEvent
{
    index: number;
    reason: string;
}

function response (origin: string, status: number, body: Record<string, unknown>): Response
{
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'content-type': 'application/json',
            'access-control-allow-origin': origin,
            'access-control-allow-methods': 'POST, OPTIONS',
            'access-control-allow-headers': 'authorization, content-type',
            'vary': 'Origin'
        }
    });
}

function configuredOrigins (): Set<string>
{
    return new Set((Deno.env.get('TELEMETRY_ALLOWED_ORIGINS') ?? '')
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean));
}

function isPlainObject (value: unknown): value is Record<string, unknown>
{
    return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function validateEvent (value: unknown): IncomingEvent | string
{
    if (!isPlainObject(value)) return 'event must be an object';
    if ('id' in value || 'created_at' in value || 'user_id' in value) return 'server-managed fields are not accepted';
    const { anonymous_id, session_id, event_name, event_data, game_version, platform } = value;
    if (Object.keys(value).some(key => !['anonymous_id', 'session_id', 'event_name', 'event_data', 'game_version', 'platform'].includes(key))) return 'unexpected event field';
    if (typeof anonymous_id !== 'string' || !uuidPattern.test(anonymous_id)) return 'anonymous_id must be a UUID';
    if (typeof session_id !== 'string' || !uuidPattern.test(session_id)) return 'session_id must be a UUID';
    if (typeof event_name !== 'string' || !allowedEventNames.has(event_name)) return 'event_name is not allowed';
    if (!isPlainObject(event_data)) return 'event_data must be an object';
    if (new TextEncoder().encode(JSON.stringify(event_data)).byteLength > maxEventDataBytes) return 'event_data is too large';
    if (typeof game_version !== 'string' || game_version.length === 0 || game_version.length > maxGameVersionLength) return 'game_version is invalid';
    if (platform !== 'desktop' && platform !== 'mobile') return 'platform is invalid';
    return { anonymous_id, session_id, event_name, event_data, game_version, platform };
}

async function derivedUserId (authorization: string | null, client: ReturnType<typeof createClient>): Promise<string | null>
{
    if (!authorization) return null;
    const match = /^Bearer\s+(.+)$/i.exec(authorization);
    if (!match) throw new Error('invalid authorization header');
    const { data, error } = await client.auth.getUser(match[1]);
    if (error || !data.user) throw new Error('invalid bearer token');
    return data.user.id;
}

Deno.serve(async request => {
    const origin = request.headers.get('origin');
    const allowedOrigins = configuredOrigins();
    if (!origin || !allowedOrigins.has(origin)) return new Response(null, { status: 403 });
    if (request.method === 'OPTIONS') return response(origin, 204, {});
    if (request.method !== 'POST') return response(origin, 405, { accepted: 0, rejected: 0, error: 'method not allowed' });

    let payload: unknown;
    try {
        payload = await request.json();
    } catch {
        return response(origin, 400, { accepted: 0, rejected: 0, error: 'invalid JSON' });
    }
    if (!isPlainObject(payload) || Object.keys(payload).length !== 1 || !Array.isArray(payload.events)) {
        return response(origin, 400, { accepted: 0, rejected: 0, error: 'events batch is required' });
    }
    if (payload.events.length === 0 || payload.events.length > maxBatchSize) {
        return response(origin, 400, { accepted: 0, rejected: 0, error: 'batch size is invalid' });
    }

    const rejected: RejectedEvent[] = [];
    const events: IncomingEvent[] = [];
    payload.events.forEach((event, index) => {
        const validated = validateEvent(event);
        if (typeof validated === 'string') rejected.push({ index, reason: validated });
        else events.push(validated);
    });
    if (rejected.length > 0) return response(origin, 400, { accepted: 0, rejected: rejected.length, rejected_events: rejected });

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) return response(origin, 500, { accepted: 0, rejected: 0, error: 'telemetry is not configured' });
    const client = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

    let userId: string | null;
    try {
        userId = await derivedUserId(request.headers.get('authorization'), client);
    } catch {
        return response(origin, 401, { accepted: 0, rejected: 0, error: 'invalid bearer token' });
    }

    const { error } = await client.from('game_events').insert(events.map(event => ({ ...event, user_id: userId })));
    if (error) return response(origin, 500, { accepted: 0, rejected: 0, error: 'unable to accept events' });
    return response(origin, 202, { accepted: events.length, rejected: 0 });
});
