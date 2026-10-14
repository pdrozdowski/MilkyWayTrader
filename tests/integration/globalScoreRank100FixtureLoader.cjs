const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

exports.createRank100CutoffSeed = async function createRank100CutoffSeed () {
    const fixtureUrl = pathToFileURL(resolve(process.cwd(), 'tests/integration/globalScoreRank100Fixture.mjs'));
    const fixture = await import(fixtureUrl.href);
    return fixture.createRank100CutoffSeed();
};
