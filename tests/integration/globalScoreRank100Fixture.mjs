import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { loadTestEnvironment, localSupabaseStatus } from '../../scripts/test-session-common.mjs';

const userCount = 101;
const batchSize = 16;
const requestTimeoutMs = 8_000;

export async function createRank100CutoffSeed ()
{
    const environment = await loadTestEnvironment();
    // This checks .env.test is loopback-only and that it matches the active local Supabase CLI endpoint.
    const { serviceRoleKey } = localSupabaseStatus(environment.url);
    const boundedFetch = (input, init = {}) => {
        const timeoutSignal = AbortSignal.timeout(requestTimeoutMs);
        const signal = init.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal;
        return fetch(input, { ...init, signal });
    };
    const admin = createClient(environment.url, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: boundedFetch }
    });
    const fixtureId = randomUUID();
    const userIds = [];
    let cleaned = false;

    const cleanup = async () => {
        if (cleaned) return;
        cleaned = true;
        const failures = [];
        for (const batch of chunks(userIds, batchSize)) {
            const results = await Promise.allSettled(batch.map(userId => admin.auth.admin.deleteUser(userId)));
            for (const result of results) {
                if (result.status === 'rejected' || result.value.error && result.value.error.message !== 'User not found') failures.push(true);
            }
        }
        if (failures.length > 0) throw new Error('Unable to clean up all local rank-cutoff test users.');
    };

    try {
        const users = [];
        for (let offset = 0; offset < userCount; offset += batchSize) {
            const batch = Array.from({ length: Math.min(batchSize, userCount - offset) }, (_, index) => {
                const sequence = offset + index;
                const uniqueId = randomUUID();
                return {
                    email: uniqueTestEmail(environment.testUserEmail, uniqueId),
                    email_confirm: true,
                    user_metadata: { local_rank_cutoff_fixture: fixtureId, local_rank_cutoff_sequence: sequence }
                };
            });
            const results = await Promise.allSettled(batch.map(attributes => admin.auth.admin.createUser(attributes)));
            for (const result of results) {
                if (result.status === 'fulfilled' && result.value.data.user) {
                    const user = result.value.data.user;
                    userIds.push(user.id);
                    users.push(user);
                }
            }
            if (results.some(result => result.status === 'rejected' || result.value?.error || !result.value?.data.user)) {
                throw new Error('Unable to provision the local rank-cutoff test users.');
            }
        }

        const profiles = users.map((user, index) => ({ user_id: user.id, nickname: nicknameFor(fixtureId, index) }));
        const { error: profileError } = await admin.from('player_profiles').insert(profiles);
        if (profileError) throw new Error('Unable to provision local rank-cutoff test profiles.');

        const existingScores = await admin.from('global_player_scores').select('score');
        if (existingScores.error) throw new Error('Unable to inspect local global scores before rank-cutoff seeding.');
        const baseline = Math.max(0, ...existingScores.data.map(row => Number(row.score)));
        const cutoffScore = baseline + 10_000;
        const scores = users.map((user, index) => ({
            user_id: user.id,
            score: index < 99 ? cutoffScore + 99 - index : cutoffScore
        }));
        const { error: scoreError } = await admin.from('global_player_scores').insert(scores);
        if (scoreError) throw new Error('Unable to provision local rank-cutoff test scores.');

        return Object.freeze({
            cutoffNicknames: Object.freeze(profiles.slice(99).map(profile => profile.nickname)),
            cleanup
        });
    } catch (error) {
        try { await cleanup(); }
        catch { throw new Error('Rank-cutoff fixture setup failed and local-user cleanup was incomplete.'); }
        throw error instanceof Error ? error : new Error('Rank-cutoff fixture setup failed.');
    }
}

function uniqueTestEmail (baseEmail, uniqueId)
{
    const at = baseEmail.lastIndexOf('@');
    if (at < 1) throw new Error('TEST_USER_EMAIL must be an email address.');
    return `${baseEmail.slice(0, at)}+rank-cutoff-${uniqueId}${baseEmail.slice(at)}`;
}

function nicknameFor (fixtureId, index)
{
    return `Rank${fixtureId.replace(/-/gu, '').slice(0, 10)}${String(index).padStart(3, '0')}`;
}

function chunks (values, size)
{
    const output = [];
    for (let index = 0; index < values.length; index += size) output.push(values.slice(index, index + size));
    return output;
}
