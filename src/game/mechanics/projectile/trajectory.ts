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

/**
 * Degrees-from-forward offsets of one volley, ordered ascending from left to right (BR-044a).
 * Odd counts add one forward projectile, even counts consist only of mirrored pairs; each pair sits
 * 5 degrees farther out than the previous one.
 */
export function volleyAngleOffsetsDegrees (projectileCount: number): readonly number[]
{
    if (!Number.isSafeInteger(projectileCount) || projectileCount < 1) return [];
    const pairCount = Math.floor(projectileCount / 2);
    const outwardDegrees = (pair: number): number => projectileCount % 2 === 1 ? 2.5 + (pair - 1) * 5 : 5 * pair;
    const offsets: number[] = [];
    for (let pair = pairCount; pair >= 1; pair--) offsets.push(-outwardDegrees(pair));
    if (projectileCount % 2 === 1) offsets.push(0);
    for (let pair = 1; pair <= pairCount; pair++) offsets.push(outwardDegrees(pair));
    return offsets;
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
