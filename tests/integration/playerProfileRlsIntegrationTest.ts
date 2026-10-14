import assert from 'node:assert/strict';
import { expect, type APIRequestContext } from '@playwright/test';
import { test, type AuthenticatedTestIdentity } from './testSessionFixture';
import type { PublicTestEnvironment } from '../testSessionSupport';

interface RestResult
{
    readonly status: number;
    readonly body: unknown;
}

// Database integration risk: profile RLS could expose or allow writes to another player's private nickname.
// A real local Supabase JWT and public PostgREST endpoint exercise the PostgreSQL policy without booting the UI.
test('an owner manages a profile while other users and anonymous clients cannot access it', async ({ request, testRunId, supabaseTestEnvironment, authenticatedIdentity, secondaryAuthenticatedIdentity }) => {
    test.setTimeout(30_000);
    const nickname = `Pilot${testRunId.replace(/-/gu, '').slice(0, 8)}`;
    const ownerCreated = await profileRequest(request, supabaseTestEnvironment, authenticatedIdentity, '/player_profiles', { method: 'POST', body: { nickname } });
    expect(ownerCreated.status, JSON.stringify(ownerCreated.body)).toBe(201);

    const ownerRead = await profileRequest(request, supabaseTestEnvironment, authenticatedIdentity, '/player_profiles?select=nickname');
    expect(ownerRead.status).toBe(200);
    assert.deepEqual(ownerRead.body, [{ nickname }]);

    const sharedNickname = `${nickname}X`;
    const ownerUpdated = await profileRequest(request, supabaseTestEnvironment, authenticatedIdentity, `/player_profiles?user_id=eq.${authenticatedIdentity.userId}`, { method: 'PATCH', body: { nickname: sharedNickname } });
    expect(ownerUpdated.status, JSON.stringify(ownerUpdated.body)).toBe(204);

    const otherCreated = await profileRequest(request, supabaseTestEnvironment, secondaryAuthenticatedIdentity, '/player_profiles', { method: 'POST', body: { nickname: sharedNickname } });
    expect(otherCreated.status).toBe(201);
    const otherCannotReadOwner = await profileRequest(request, supabaseTestEnvironment, secondaryAuthenticatedIdentity, `/player_profiles?user_id=eq.${authenticatedIdentity.userId}&select=nickname`);
    expect(otherCannotReadOwner.status).toBe(200);
    assert.deepEqual(otherCannotReadOwner.body, []);
    const otherRead = await profileRequest(request, supabaseTestEnvironment, secondaryAuthenticatedIdentity, '/player_profiles?select=nickname');
    expect(otherRead.status).toBe(200);
    assert.deepEqual(otherRead.body, [{ nickname: sharedNickname }]);

    const anonymousRead = await profileRequest(request, supabaseTestEnvironment, null, '/player_profiles?select=nickname');
    expect(anonymousRead.status).toBe(401);
});

async function profileRequest (
    request: APIRequestContext,
    environment: PublicTestEnvironment,
    identity: AuthenticatedTestIdentity | null,
    path: string,
    operation: { readonly method?: 'POST' | 'PATCH'; readonly body?: { readonly nickname: string } } = {}
): Promise<RestResult>
{
    const response = await request.fetch(new URL(`/rest/v1${path}`, environment.url).toString(), {
        method: operation.method ?? 'GET',
        timeout: 10_000,
        headers: {
            apikey: environment.publishableKey,
            ...(identity ? { authorization: `Bearer ${identity.accessToken}` } : {}),
            ...(operation.body ? { 'content-type': 'application/json', prefer: operation.method === 'PATCH' ? 'return=minimal' : 'return=representation' } : {})
        },
        ...(operation.body ? { data: operation.body } : {})
    });
    return { status: response.status(), body: response.status() === 204 ? null : await response.json() };
}
