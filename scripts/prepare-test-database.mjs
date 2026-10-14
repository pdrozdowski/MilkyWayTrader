import { loadTestEnvironment, localSupabaseStatus, runSupabase, startLocalSupabase } from './test-session-common.mjs';

const environment = await loadTestEnvironment();
startLocalSupabase();
localSupabaseStatus(environment.url);
runSupabase(['db', 'reset', '--local']);
process.stdout.write('PLAYWRIGHT_SUITE_DB_RESET\n');
