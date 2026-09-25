// The ship centre leaves orbit 70 px beyond a planet's physical radius.
export const PLANET_LANDING_SURFACE_GAP = 52;

export function planetLandingRadius (planetRadius: number, shipRadius: number): number
{
    return planetOrbitBoundaryRadius(planetRadius, shipRadius);
}

export function planetOrbitBoundaryRadius (planetRadius: number, shipRadius: number): number
{
    return planetRadius + shipRadius + PLANET_LANDING_SURFACE_GAP;
}

export function isWithinPlanetOrbitBoundary (distance: number, planetRadius: number, shipRadius: number): boolean
{
    return distance <= planetOrbitBoundaryRadius(planetRadius, shipRadius);
}

export function canLandNearPlanet (distance: number, shipRadius: number, planetRadius: number): boolean
{
    return isWithinPlanetOrbitBoundary(distance, planetRadius, shipRadius);
}
