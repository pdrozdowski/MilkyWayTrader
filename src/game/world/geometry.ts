export interface CircleObstacle
{
    x: number;
    y: number;
    radius: number;
}

export interface MovingCircle
{
    readonly id: string;
    readonly start: Readonly<{ x: number; y: number }>;
    readonly end: Readonly<{ x: number; y: number }>;
    readonly radius: number;
}

// Returns the first normalized time at which two swept circles touch.
export function sweptCircleIntersection (first: MovingCircle, second: MovingCircle): number | null
{
    const offsetX = first.start.x - second.start.x;
    const offsetY = first.start.y - second.start.y;
    const velocityX = (first.end.x - first.start.x) - (second.end.x - second.start.x);
    const velocityY = (first.end.y - first.start.y) - (second.end.y - second.start.y);
    const radius = first.radius + second.radius;
    const constant = offsetX * offsetX + offsetY * offsetY - radius * radius;
    if (constant <= 0) return 0;
    const quadratic = velocityX * velocityX + velocityY * velocityY;
    if (quadratic === 0) return null;
    const linear = 2 * (offsetX * velocityX + offsetY * velocityY);
    const discriminant = linear * linear - 4 * quadratic * constant;
    if (discriminant < 0) return null;
    const time = (-linear - Math.sqrt(discriminant)) / (2 * quadratic);
    return time >= 0 && time <= 1 ? time : null;
}
