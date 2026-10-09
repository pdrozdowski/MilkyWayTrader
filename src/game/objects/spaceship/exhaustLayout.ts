import { shipBoostTuning, shipFlameFrameRate, shipFlameLengths } from './definition';

/** Flame artwork an exhaust pipe can show. */
export type EngineFlameVariant = 'normal' | 'hot' | 'boost';

export interface EngineExhaustPipe
{
    /** Nozzle centre in ship-local pixels; negative is the ship's left. */
    readonly x: number;
    readonly variant: EngineFlameVariant;
    readonly lengthMultiplier: number;
}

/** Nozzle centres in ship-local pixels. */
export const engineExhaustPipeX = { centre: 0, left: -7, right: 7 } as const;

/** An upgraded engine burns a flame this many times longer than the level-one flame. */
export const hotFlameLengthMultiplier = 2.5;

const lengthMultiplierByVariant: Readonly<Record<EngineFlameVariant, number>> = {
    normal: 1,
    hot: hotFlameLengthMultiplier,
    boost: shipBoostTuning.flameLengthMultiplier
};

function pipe (x: number, variant: EngineFlameVariant): EngineExhaustPipe
{
    return Object.freeze({ x, variant, lengthMultiplier: lengthMultiplierByVariant[variant] });
}

/** Flame length of the current pulse frame; the retired ship animation baked exactly this sequence. */
export function engineFlamePulseLength (timeMs: number): number
{
    return shipFlameLengths[Math.floor(timeMs * shipFlameFrameRate / 1000) % shipFlameLengths.length];
}

/**
 * Exhaust pipes for the purchased engine level (BR-074). Extras arrive as nozzles: level one runs a
 * single centre pipe, twin pipes appear at level three, and level five adds a hotter centre pipe
 * between them. Boosting always shows the two level-one pipes as the boosted flame.
 */
export function engineExhaustLayout (engineLevel: number, boosting: boolean): readonly EngineExhaustPipe[]
{
    const twin = [pipe(engineExhaustPipeX.left, 'normal'), pipe(engineExhaustPipeX.right, 'normal')];
    if (boosting) return Object.freeze([pipe(engineExhaustPipeX.left, 'boost'), pipe(engineExhaustPipeX.right, 'boost')]);
    const level = Number.isSafeInteger(engineLevel) ? Math.min(5, Math.max(1, engineLevel)) : 1;
    if (level <= 1) return Object.freeze([pipe(engineExhaustPipeX.centre, 'normal')]);
    if (level === 2) return Object.freeze([pipe(engineExhaustPipeX.centre, 'hot')]);
    if (level === 3) return Object.freeze(twin);
    if (level === 4) return Object.freeze([pipe(engineExhaustPipeX.left, 'hot'), pipe(engineExhaustPipeX.right, 'hot')]);
    return Object.freeze([
        pipe(engineExhaustPipeX.left, 'normal'),
        pipe(engineExhaustPipeX.centre, 'hot'),
        pipe(engineExhaustPipeX.right, 'normal')
    ]);
}
