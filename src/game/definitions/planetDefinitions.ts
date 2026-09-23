export interface PlanetDefinition
{
    readonly id: 'seroton' | 'lactozis-7c' | 'maslo-prime';
    readonly name: string;
    readonly radius: number;
    readonly orbitRadius: number;
    readonly initialPhaseRadians: number;
    readonly orbitalPeriodMs: number;
    readonly variant: 'blue' | 'green' | 'amber';
    readonly spinSpeed: number;
}

export type PlanetId = PlanetDefinition['id'];

// Each radius clears Moolaris or the preceding planet's outer orbital band by 50 pixels.
export const planetDefinitions: readonly PlanetDefinition[] = [
    {
        id: 'seroton', name: 'Seroton', radius: 144,
        orbitRadius: 1169, initialPhaseRadians: 0,
        orbitalPeriodMs: 180_000, variant: 'blue', spinSpeed: 0.8
    },
    {
        id: 'lactozis-7c', name: 'Lactozis-7C', radius: 158.4,
        orbitRadius: 1521.4, initialPhaseRadians: Math.PI * 2 / 3,
        orbitalPeriodMs: 240_000, variant: 'green', spinSpeed: 1
    },
    {
        id: 'maslo-prime', name: 'Maslo-Prime', radius: 172.8,
        orbitRadius: 1902.6, initialPhaseRadians: Math.PI * 4 / 3,
        orbitalPeriodMs: 300_000, variant: 'amber', spinSpeed: 0.6
    }
];

export const planetDefinitionById: Readonly<Record<PlanetId, PlanetDefinition>> = Object.freeze(
    Object.fromEntries(planetDefinitions.map(definition => [definition.id, definition])) as Record<PlanetId, PlanetDefinition>
);

export function getPlanetDefinition (id: string): PlanetDefinition
{
    const definition = planetDefinitionById[id as PlanetId];
    if (!definition) throw new Error(`Unknown configured planet id: ${id}.`);
    return definition;
}
