import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { ensureSessionDirectory, loadTestEnvironment, localSupabaseStatus, sessionDirectory } from './test-session-common.mjs';

const mode = process.argv[2];
if (mode !== 'anonymous' && mode !== 'authenticated') throw new Error('Usage: node scripts/create-test-session.mjs <anonymous|authenticated>');

const environment = await loadTestEnvironment();
const id = randomUUID();
const anonymousId = randomUUID();
const artifact = { id, mode, anonymousId, userId: null, authStorageKey: null, authSession: null };

if (mode === 'authenticated') {
    const { serviceRoleKey } = localSupabaseStatus();
    const admin = createClient(environment.url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const email = testEmail(environment.testUserEmail, id);
    const created = await admin.auth.admin.createUser({
        email,
        password: environment.testUserPassword,
        email_confirm: true,
        user_metadata: { playwright_test_session_id: id }
    });
    if (created.error || !created.data.user) throw new Error(`Unable to create local test user: ${created.error?.message ?? 'no user returned'}`);
    const client = createClient(environment.url, environment.publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const signedIn = await client.auth.signInWithPassword({ email, password: environment.testUserPassword });
    if (signedIn.error || !signedIn.data.session) {
        await admin.auth.admin.deleteUser(created.data.user.id);
        throw new Error(`Unable to create local authenticated session: ${signedIn.error?.message ?? 'no session returned'}`);
    }
    artifact.userId = created.data.user.id;
    artifact.authStorageKey = `sb-${new URL(environment.url).hostname.split('.')[0]}-auth-token`;
    artifact.authSession = signedIn.data.session;
}

await ensureSessionDirectory();
const sessionFile = resolve(sessionDirectory, `${id}.json`);
await writeFile(sessionFile, JSON.stringify(artifact), { encoding: 'utf8', mode: 0o600 });
process.stdout.write(`${JSON.stringify({ sessionFile: basename(sessionFile) })}\n`);

function testEmail (baseEmail, sessionId)
{
    const at = baseEmail.lastIndexOf('@');
    if (at < 1) throw new Error('TEST_USER_EMAIL must be an email address.');
    return `${baseEmail.slice(0, at)}+playwright-${sessionId}${baseEmail.slice(at)}`;
}
