import { loadTestEnvironment, localSupabaseStatus, runSupabase } from './test-session-common.mjs';

await loadTestEnvironment();
localSupabaseStatus();
runSupabase(['db', 'reset', '--local']);
