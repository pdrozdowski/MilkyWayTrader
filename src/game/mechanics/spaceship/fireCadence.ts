// Keep held fire on a fixed beat, independent of render-frame lateness.
export class FireCadence
{
    private nextShotAt: number | null = null;
    private lastShotAt = Number.NEGATIVE_INFINITY;

    private readonly interval: number;

    constructor (interval: number)
    {
        this.interval = interval;
    }

    shouldFire (time: number, enabled: boolean): boolean
    {
        if (!enabled) {
            this.nextShotAt = null;
            return false;
        }
        if (this.nextShotAt === null) this.nextShotAt = Math.max(time, this.lastShotAt + this.interval);
        if (time < this.nextShotAt) return false;
        this.nextShotAt += this.interval;
        // After a long stall, resume normally instead of replaying missed shots.
        if (this.nextShotAt - time < this.interval / 2) this.nextShotAt = time + this.interval;
        this.lastShotAt = time;
        return true;
    }
}
