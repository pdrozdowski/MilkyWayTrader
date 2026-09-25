export interface PlanetLifecycleState
{
    readonly capturedPlanetId: string | null;
    readonly landedPlanetId: string | null;
    readonly relandingLockedPlanetId: string | null;
}
