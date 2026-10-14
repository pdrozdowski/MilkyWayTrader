import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { test as base } from '@playwright/test';
import { createTestSession, loadPublicTestEnvironment, removeTestSessionArtifact, type PublicTestEnvironment, type SessionArtifact } from '../testSessionSupport';

const require = createRequire(`${process.cwd()}/package.json`);
const { createRank100CutoffSeed } = require('./tests/integration/globalScoreRank100FixtureLoader.cjs') as {
    createRank100CutoffSeed(): Promise<{ readonly cutoffNicknames: readonly string[]; cleanup(): Promise<void> }>;
};

export interface AuthenticatedTestIdentity
{
    readonly testRunId: string;
    readonly userId: string;
    readonly accessToken: string;
}

type Fixtures = {
    readonly testRunId: string;
    readonly supabaseTestEnvironment: PublicTestEnvironment;
    readonly authenticatedIdentity: AuthenticatedTestIdentity;
    readonly secondaryAuthenticatedIdentity: AuthenticatedTestIdentity;
    readonly rank100CutoffSeed: { readonly cutoffNicknames: readonly string[] };
};

export const test = base.extend<Fixtures>({
    testRunId: async ({}, use) => { await use(randomUUID()); },
    supabaseTestEnvironment: async ({}, use) => { await use(await loadPublicTestEnvironment()); },
    authenticatedIdentity: async ({ testRunId }, use) => {
        const identityRunId = testRunId;
        const artifact = await createTestSession('authenticated', identityRunId);
        try { await use(identityFrom(artifact)); } finally { await removeTestSessionArtifact(artifact.id); }
    },
    secondaryAuthenticatedIdentity: async ({}, use) => {
        const artifact = await createTestSession('authenticated', randomUUID());
        try { await use(identityFrom(artifact)); } finally { await removeTestSessionArtifact(artifact.id); }
    },
    rank100CutoffSeed: async ({}, use, testInfo) => {
        testInfo.setTimeout(210_000);
        const seed = await createRank100CutoffSeed();
        try { await use({ cutoffNicknames: seed.cutoffNicknames }); }
        finally { await seed.cleanup(); }
    }
});

function identityFrom (artifact: SessionArtifact): AuthenticatedTestIdentity
{
    const session = artifact.authSession as { readonly access_token?: unknown } | null;
    if (!artifact.userId || !session || typeof session.access_token !== 'string') throw new Error('Authenticated test setup returned no usable identity.');
    return Object.freeze({ testRunId: artifact.testRunId, userId: artifact.userId, accessToken: session.access_token });
}
