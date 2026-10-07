import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planetIds } from '../../src/game/domain/planetCatalog.ts';
import { planetDefinitions } from '../../src/game/definitions/planetDefinitions.ts';
import { planetMarketTunings } from '../../src/game/definitions/serotonMarketDefinitions.ts';

test('the runtime planet catalogue mirrors the configured definitions and market tunings', () => {
    assert.deepEqual([...planetIds], planetDefinitions.map(definition => definition.id));
    assert.deepEqual([...planetIds].sort(), Object.keys(planetMarketTunings).sort());
    assert.equal(new Set(planetIds).size, planetIds.length, 'planet ids are unique');
});
