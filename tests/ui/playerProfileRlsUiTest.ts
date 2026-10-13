import assert from 'node:assert/strict';
import { expect, type Page } from '@playwright/test';
import { test } from './testSessionFixture';

interface RestResult
{
    readonly status: number;
    readonly body: unknown;
}

// Browser risk: profile-table RLS may expose or allow writes to another player's private nickname.
// Adapter fakes cannot exercise PostgreSQL policies with distinct signed-in and anonymous JWTs.
// This uniquely verifies owner creation/update, non-unique nicknames, and denial across real local Supabase sessions.
test.describe('local player-profile RLS', () => {
    test.use({ testSessionMode: 'authenticated' });

    test('an owner manages a profile while other users and anonymous sessions cannot access it', async ({ page, testSession, secondaryAuthenticatedPage, anonymousPage }) => {
        test.setTimeout(60_000);
        expect(testSession.mode).toBe('authenticated');
        const nickname = `Pilot${Date.now().toString().slice(-8)}`;
        const ownerCreated = await profileRequest(page, '/player_profiles', { method: 'POST', body: { nickname } });
        expect(ownerCreated.status, JSON.stringify(ownerCreated.body)).toBe(201);

        const ownerRead = await profileRequest(page, '/player_profiles?select=nickname');
        expect(ownerRead.status).toBe(200);
        assert.deepEqual(ownerRead.body, [{ nickname }]);

        const sharedNickname = `${nickname}X`;
        const ownerUpdated = await profileRequest(page, `/player_profiles?user_id=eq.${testSession.userId}`, { method: 'PATCH', body: { nickname: sharedNickname } });
        expect(ownerUpdated.status, JSON.stringify(ownerUpdated.body)).toBe(204);

        const otherCreated = await profileRequest(secondaryAuthenticatedPage, '/player_profiles', { method: 'POST', body: { nickname: sharedNickname } });
        expect(otherCreated.status).toBe(201);
        const otherCannotReadOwner = await profileRequest(secondaryAuthenticatedPage, `/player_profiles?user_id=eq.${testSession.userId}&select=nickname`);
        expect(otherCannotReadOwner.status).toBe(200);
        assert.deepEqual(otherCannotReadOwner.body, []);
        const otherRead = await profileRequest(secondaryAuthenticatedPage, '/player_profiles?select=nickname');
        expect(otherRead.status).toBe(200);
        assert.deepEqual(otherRead.body, [{ nickname: sharedNickname }]);

        const anonymousRead = await profileRequest(anonymousPage, '/player_profiles?select=nickname');
        expect(anonymousRead.status).toBe(401);
    });
});

async function profileRequest (page: Page, path: string, request: { method?: 'POST' | 'PATCH'; body?: { nickname: string } } = {}): Promise<RestResult>
{
    if (!page.url().startsWith('http://127.0.0.1:8080/')) await page.goto('/', { waitUntil: 'domcontentloaded' });
    return page.evaluate(async ({ path, request }) => {
        const configurationModulePath = '/src/game/application/auth/configuration.ts';
        const { browserAuthConfiguration } = await import(/* @vite-ignore */ configurationModulePath) as {
            browserAuthConfiguration: () => { url?: string; publishableKey?: string };
        };
        const configuration = browserAuthConfiguration();
        if (!configuration.url || !configuration.publishableKey) throw new Error('Missing public Supabase browser configuration.');
        const serializedSession = Object.keys(window.localStorage)
            .filter(key => key.startsWith('sb-') && key.endsWith('-auth-token'))
            .map(key => window.localStorage.getItem(key))
            .find((value): value is string => value !== null);
        const session = serializedSession ? JSON.parse(serializedSession) as { access_token?: string } : null;
        const response = await fetch(`${configuration.url}/rest/v1${path}`, {
            method: request.method ?? 'GET',
            headers: {
                apikey: configuration.publishableKey,
                ...(session?.access_token ? { authorization: `Bearer ${session.access_token}` } : {}),
                ...(request.body ? { 'content-type': 'application/json', prefer: request.method === 'PATCH' ? 'return=minimal' : 'return=representation' } : {})
            },
            ...(request.body ? { body: JSON.stringify(request.body) } : {})
        });
        return { status: response.status, body: response.status === 204 ? null : await response.json() };
    }, { path, request });
}
