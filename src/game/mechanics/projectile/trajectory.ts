interface Point { x: number; y: number }
interface Circle extends Point { radius: number }

export function shotTrajectory (ship: Point, rotation: number, muzzleOffset: number, speed: number): { start: Point; velocity: Point }
{
    const direction = { x: Math.sin(rotation), y: -Math.cos(rotation) };
    return {
        start: { x: ship.x + direction.x * muzzleOffset, y: ship.y + direction.y * muzzleOffset },
        velocity: { x: direction.x * speed, y: direction.y * speed }
    };
}

/** Degrees between neighbouring volley projectiles (BR-044a). */
export const volleyAngleStepDegrees = 5;

/**
 * Degrees-from-forward offsets of one volley, ordered ascending from left to right (BR-044a).
 * The pattern is centred on the heading and every neighbouring pair sits one uniform step apart:
 * an odd count fires the forward shot with mirrored pairs outside it, and an even count straddles
 * the heading at half a step so its two frontmost projectiles stay as far apart as the others.
 */
export function volleyAngleOffsetsDegrees (projectileCount: number): readonly number[]
{
    if (!Number.isSafeInteger(projectileCount) || projectileCount < 1) return [];
    const centre = (projectileCount - 1) / 2;
    return Array.from({ length: projectileCount }, (_, index) => (index - centre) * volleyAngleStepDegrees);
}

/** Nose-offset trajectory of one volley projectile, rotated by its left-to-right angle offset. */
export function volleyShotTrajectory (ship: Point, rotation: number, angleOffsetDegrees: number, muzzleOffset: number, speed: number): { start: Point; velocity: Point }
{
    return shotTrajectory(ship, rotation + angleOffsetDegrees * Math.PI / 180, muzzleOffset, speed);
}

// Closest point on the whole segment, including its endpoints and tangent hits.
export function segmentHitsCircle (start: Point, end: Point, circle: Circle, padding: number): boolean
{
    const x = end.x - start.x;
    const y = end.y - start.y;
    const lengthSquared = x * x + y * y;
    const fraction = lengthSquared > 0 ? Math.max(0, Math.min(1, ((circle.x - start.x) * x + (circle.y - start.y) * y) / lengthSquared)) : 0;
    return Math.hypot(start.x + x * fraction - circle.x, start.y + y * fraction - circle.y) <= circle.radius + padding;
}

export function firstSegmentCircleIntersection (start: Point, end: Point, circle: Circle, padding: number): number | null
{
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const offsetX = start.x - circle.x;
    const offsetY = start.y - circle.y;
    const radius = circle.radius + padding;
    const constant = offsetX * offsetX + offsetY * offsetY - radius * radius;
    if (constant <= 0) return 0;
    const quadratic = deltaX * deltaX + deltaY * deltaY;
    if (quadratic === 0) return null;
    const linear = 2 * (offsetX * deltaX + offsetY * deltaY);
    const discriminant = linear * linear - 4 * quadratic * constant;
    if (discriminant < 0) return null;
    const time = (-linear - Math.sqrt(discriminant)) / (2 * quadratic);
    return time >= 0 && time <= 1 ? time : null;
}
