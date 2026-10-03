import type { AsteroidSize } from '../../state/asteroidState.ts';
import { asteroidTuning } from '../../definitions/gameplayTuning.ts';

export const asteroidDamageRanges: Readonly<Record<AsteroidSize, Readonly<{ minimum: number; maximum: number }>>> = asteroidTuning.shipDamage;

export const moolarisDamageRange = asteroidDamageRanges.small;

export interface RandomIntegerResult
{
    readonly value: number;
    readonly nextState: number;
}

/** A persisted Mulberry32 state; zero is valid and has a non-degenerate sequence. */
export function nextRandomInteger (state: number, minimum: number, maximum: number): RandomIntegerResult
{
    const nextState = (state + 0x6D2B79F5) >>> 0;
    let value = nextState;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    const unit = ((value ^ value >>> 14) >>> 0) / 4_294_967_296;
    return { value: minimum + Math.floor(unit * (maximum - minimum + 1)), nextState };
}
