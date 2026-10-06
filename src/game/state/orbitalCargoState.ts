import type { CommodityContainerState } from './commodityContainerState';
import type { Vector2State } from './vector2State';

export type OrbitalCargoManifest = readonly CommodityContainerState[];

export interface OrbitalCargoOrbitState
{
    readonly angleRadians: number;
    readonly radius: number;
    readonly rotationRadians: number;
}

export interface OrbitalCargoState
{
    readonly id: string;
    readonly position: Vector2State;
    readonly orbit: OrbitalCargoOrbitState;
    readonly hitPoints: number;
    readonly manifest: OrbitalCargoManifest;
}
