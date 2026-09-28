import { moolarisDefinition } from '../definitions/moolarisDefinition.ts';
import { planetDefinitions } from '../definitions/planetDefinitions.ts';

export const ORBITAL_PATH_DASH_LENGTH = 50;
export const ORBITAL_PATH_GAP_LENGTH = 10;

export interface OrbitalPathDash
{
    readonly centre: { readonly x: number; readonly y: number };
    readonly radius: number;
    readonly startRadians: number;
    readonly endRadians: number;
}

export function createOrbitalPathDashes (): readonly OrbitalPathDash[]
{
    return planetDefinitions.flatMap(definition => createCircularPathDashes(definition.orbitRadius));
}

function createCircularPathDashes (radius: number): readonly OrbitalPathDash[]
{
    const circumference = Math.PI * 2 * radius;
    const dashes: OrbitalPathDash[] = [];
    for (let distance = 0; distance < circumference; distance += ORBITAL_PATH_DASH_LENGTH + ORBITAL_PATH_GAP_LENGTH) {
        const dashEnd = Math.min(distance + ORBITAL_PATH_DASH_LENGTH, circumference);
        dashes.push({
            centre: moolarisDefinition.position,
            radius,
            startRadians: distance / radius,
            endRadians: dashEnd / radius
        });
    }
    return dashes;
}
