const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

exports.loadTestSessionRuntime = async function loadTestSessionRuntime () {
    const commonUrl = pathToFileURL(resolve(__dirname, 'test-session-common.mjs'));
    const [common, supabase] = await Promise.all([
        import(commonUrl.href),
        import('@supabase/supabase-js')
    ]);
    return Object.freeze({
        createClient: supabase.createClient,
        loadTestEnvironment: common.loadTestEnvironment,
        localSupabaseStatus: common.localSupabaseStatus
    });
};
