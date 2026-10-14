import { readdir, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { loadTestEnvironment, localSupabaseStatus, sessionDirectory } from './test-session-common.mjs';

const environment = await loadTestEnvironment();
const selected = process.env.PLAYWRIGHT_TEST_SESSION_FILE;
const files = selected ? [selected] : await sessionFiles();
let failure = null;
const deletedUserIds = new Set();
for (const file of files) {
    try { await cleanup(resolve(sessionDirectory, file), deletedUserIds); } catch (error) { failure ??= error; }
}
if (failure) throw failure;

async function sessionFiles ()
{
    try { return (await readdir(sessionDirectory)).filter(file => file.endsWith('.json')); } catch (error) {
        if (error && typeof error === 'object' && error.code === 'ENOENT') return [];
        throw error;
    }
}

async function cleanup (file, deletedUserIds)
{
    const session = JSON.parse(await readFile(file, 'utf8'));
    const { serviceRoleKey } = localSupabaseStatus(environment.url);
    const admin = createClient(environment.url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    if (session.userId && !deletedUserIds.has(session.userId)) {
        const deleted = await admin.auth.admin.deleteUser(session.userId);
        if (deleted.error && deleted.error.message !== 'User not found') throw new Error(`Unable to remove local test user: ${deleted.error.message}`);
        deletedUserIds.add(session.userId);
    }
    await rm(file, { force: true });
}
