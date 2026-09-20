export type ObjectAsset =
    | { kind: 'image'; key: string; path: string }
    | { kind: 'spritesheet'; key: string; path: string; frameWidth: number; frameHeight: number }
    | { kind: 'atlas'; key: string; path: string; dataPath: string };

export interface ObjectAnimation {
    key: string;
    frames: { key: string; frame?: number | string }[];
    frameRate: number;
    repeat: number;
}

// Dimensions use unscaled texture pixels; SceneObject centers shape offsets.
export interface ObjectPhysics {
    kind: 'dynamic' | 'static';
    shape: { kind: 'circle'; radius: number } | { kind: 'rectangle'; width: number; height: number };
    bounce?: number;
    worldBounds?: boolean;
}

export interface ObjectVisual {
    texture: string;
    frame?: number | string;
    scale: number;
    depth: number;
    animation?: string;
}

export interface GameObjectDefinition {
    id: string;
    assets: ObjectAsset[];
    animations: ObjectAnimation[];
    visual: ObjectVisual;
    variants?: Record<string, Partial<ObjectVisual>>;
    physics?: ObjectPhysics;
}

export interface SceneObjectOptions {
    x: number;
    y: number;
    size?: number;
    depth?: number;
    variant?: string;
}
