// Pure movement math: independently usable without Phaser.
export function flightVelocity (
    velocity: { x: number; y: number },
    targetDelta: { x: number; y: number } | null,
    seconds: number,
    tuning: { maxSpeed: number; accelerationSeconds: number; stoppingSeconds: number; accelerationRate?: number; decelerationRate?: number }
): { x: number; y: number; enginesOn: boolean }
{
    const speed = Math.hypot(velocity.x, velocity.y);
    if (seconds <= 0) return { ...velocity, enginesOn: false };
    if (targetDelta) {
        const distance = Math.hypot(targetDelta.x, targetDelta.y);
        if (distance <= 2) return { x: 0, y: 0, enginesOn: false };
        const acceleration = tuning.accelerationRate ?? tuning.maxSpeed / tuning.accelerationSeconds;
        const deceleration = tuning.decelerationRate ?? tuning.maxSpeed / tuning.stoppingSeconds;
        const nextSpeed = Math.min(distance / seconds, speed > tuning.maxSpeed
            ? Math.max(tuning.maxSpeed, speed - deceleration * seconds)
            : Math.min(tuning.maxSpeed, speed + acceleration * seconds));
        return { x: targetDelta.x / distance * nextSpeed, y: targetDelta.y / distance * nextSpeed, enginesOn: true };
    }
    const nextSpeed = Math.max(0, speed - (tuning.decelerationRate ?? tuning.maxSpeed / tuning.stoppingSeconds) * seconds);
    const ratio = speed > 0 ? nextSpeed / speed : 0;
    return { x: velocity.x * ratio, y: velocity.y * ratio, enginesOn: false };
}

export function boostAccelerationRate (currentSpeed: number, normalMaxSpeed: number, multiplier: number, seconds: number): number
{
    return Math.max(0, normalMaxSpeed * multiplier - currentSpeed) / seconds;
}

export function directionRotation (x: number, y: number, previousRotation: number): number
{
    return Math.hypot(x, y) > 0.1 ? Math.atan2(y, x) + Math.PI / 2 : previousRotation;
}
