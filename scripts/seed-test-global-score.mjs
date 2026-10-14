import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { loadTestEnvironment, localSupabaseStatus, sessionDirectory } from './test-session-common.mjs';

const [sessionId, rawScore] = process.argv.slice(2);
if (!sessionId || !/^[0-9a-f-]{36}$/iu.test(sessionId)) throw new Error('A test session ID is required.');
const score = Number(rawScore);
if (!Number.isSafeInteger(score) || score < 0) throw new Error('A non-negative integer test score is required.');

const session = JSON.parse(await readFile(resolve(sessionDirectory, `${sessionId}.json`), 'utf8'));
if (session.id !== sessionId || session.mode !== 'authenticated' || typeof session.userId !== 'string') {
    throw new Error('A matching authenticated local test session is required.');
}
const environment = await loadTestEnvironment();
const { serviceRoleKey } = localSupabaseStatus(environment.url);
const requestTimeoutMs = 8_000;
const boundedFetch = (input, init = {}) => {
    const timeoutSignal = AbortSignal.timeout(requestTimeoutMs);
    const signal = init.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal;
    return fetch(input, { ...init, signal });
};
const admin = createClient(environment.url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: boundedFetch }
});
const nickname = `Pilot${session.userId.replace(/-/gu, '').slice(0, 12)}`;
const { error: profileError } = await admin.from('player_profiles').upsert({ user_id: session.userId, nickname });
if (profileError) throw new Error('Unable to seed the local global-score profile.');
const { error: scoreError } = await admin.from('global_player_scores').upsert({ user_id: session.userId, score, achieved_at: '2026-10-14T10:00:00.000Z' });
if (scoreError) throw new Error('Unable to seed the local global score.');
process.stdout.write(`${JSON.stringify({ nickname })}\n`);
