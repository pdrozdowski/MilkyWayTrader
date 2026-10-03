import { readdir, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { loadTestEnvironment, localSupabaseStatus, sessionDirectory } from './test-session-common.mjs';

const environment = await loadTestEnvironment();
const selected = process.env.PLAYWRIGHT_TEST_SESSION_FILE;
const files = selected ? [selected] : await sessionFiles();
let failure = null;
for (const file of files) {
    try { await cleanup(resolve(sessionDirectory, file)); } catch (error) { failure ??= error; }
}
if (failure) throw failure;

async function sessionFiles ()
{
    try { return (await readdir(sessionDirectory)).filter(file => file.endsWith('.json')); } catch (error) {
        if (error && typeof error === 'object' && error.code === 'ENOENT') return [];
        throw error;
    }
}

async function cleanup (file)
{
    const session = JSON.parse(await readFile(file, 'utf8'));
    const { serviceRoleKey } = localSupabaseStatus();
    const admin = createClient(environment.url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const events = await admin.from('game_events').delete().eq('anonymous_id', session.anonymousId);
    if (events.error) throw new Error(`Unable to remove test telemetry: ${events.error.message}`);
    if (session.userId) {
        const deleted = await admin.auth.admin.deleteUser(session.userId);
        if (deleted.error && deleted.error.message !== 'User not found') throw new Error(`Unable to remove local test user: ${deleted.error.message}`);
    }
    await rm(file, { force: true });
}
