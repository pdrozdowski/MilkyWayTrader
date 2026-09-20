// Preserve the original smallest planet's clearance: 1.5 × its 48-pixel radius.
export const PLANET_LANDING_SURFACE_GAP = 72;

export function planetLandingRadius (planetRadius: number, shipRadius: number): number
{
    return planetRadius + shipRadius + PLANET_LANDING_SURFACE_GAP;
}

export function canLandNearPlanet (distance: number, shipRadius: number, planetRadius: number): boolean
{
    return distance <= planetLandingRadius(planetRadius, shipRadius);
}
