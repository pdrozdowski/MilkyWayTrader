/**
 * Runtime list of the configured landable planets. It mirrors the canonical `PlanetId` union in
 * `src/game/state/planetState.ts` and the configured `planetDefinitions`; tests and the codec's
 * exact-set rule keep the type, this list, and the planet definitions bound together.
 */
export const planetIds = ['seroton', 'lactozis-7c', 'maslo-prime'] as const;
