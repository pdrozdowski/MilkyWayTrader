import type { CircleObstacle } from './geometry';

// Spatial presentation state. Business data belongs to the Phaser-independent domain layer.
export interface PlanetWorldState extends CircleObstacle {
    readonly id: string;
    name: string;
}
