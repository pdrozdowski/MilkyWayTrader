import { GameObjects, Physics, Scene } from 'phaser';
import type { GameObjectDefinition, SceneObjectOptions } from './types';

export class SceneObject
{
    readonly sprite: GameObjects.Sprite;
    readonly body: Physics.Arcade.Body | Physics.Arcade.StaticBody | null;
    private readonly cleanups: (() => void)[] = [];
    private destroyed = false;

    constructor (protected readonly scene: Scene, readonly definition: GameObjectDefinition, options: SceneObjectOptions)
    {
        const variant = options.variant ? definition.variants?.[options.variant] : undefined;
        if (options.variant && !variant) throw new Error(`Unknown ${definition.id} variant: ${options.variant}`);
        const visual = { ...definition.visual, ...variant };
        this.sprite = scene.add.sprite(options.x, options.y, visual.texture, visual.frame)
            .setScale(visual.scale).setDepth(options.depth ?? visual.depth);
        if (definition.physics) {
            scene.physics.add.existing(this.sprite, definition.physics.kind === 'static');
            this.body = this.sprite.body as Physics.Arcade.Body | Physics.Arcade.StaticBody;
            if (this.body instanceof Physics.Arcade.Body) {
                this.body.setAllowGravity(false);
                this.body.setBounce(definition.physics.bounce ?? 0);
                this.body.setCollideWorldBounds(definition.physics.worldBounds ?? false);
            }
        } else this.body = null;
        if (options.size !== undefined) this.setSize(options.size);
        else this.syncBody();
        if (visual.animation) this.sprite.play(visual.animation);
        scene.events.once('shutdown', this.destroy, this);
    }

    get radius (): number
    {
        const shape = this.definition.physics?.shape;
        return shape?.kind === 'circle' ? shape.radius * this.sprite.scaleX : this.sprite.displayWidth / 2;
    }

    setSize (size: number): this
    {
        if (!Number.isFinite(size) || size <= 0) throw new Error('Object size must be positive.');
        this.sprite.setScale(size / this.sprite.width);
        this.syncBody();
        return this;
    }

    setPosition (x: number, y: number): this
    {
        this.sprite.setPosition(x, y);
        this.syncBody();
        return this;
    }

    protected syncBody (): void
    {
        const shape = this.definition.physics?.shape;
        const body = this.body;
        if (!body || !shape) return;
        const isStatic = body instanceof Physics.Arcade.StaticBody;
        const scale = isStatic ? this.sprite.scaleX : 1;
        const width = shape.kind === 'circle' ? shape.radius * 2 : shape.width;
        const height = shape.kind === 'circle' ? shape.radius * 2 : shape.height;
        const offsetX = (this.sprite.width - width) / 2 * scale;
        const offsetY = (this.sprite.height - height) / 2 * scale;
        if (shape.kind === 'circle') body.setCircle(shape.radius * scale, offsetX, offsetY);
        else {
            body.setSize(width * scale, height * scale, false);
            body.setOffset(offsetX, offsetY);
        }
        if (isStatic) body.reset(this.sprite.x, this.sprite.y);
        else body.updateFromGameObject();
    }

    protected ownCleanup (cleanup: () => void): void
    {
        this.cleanups.push(cleanup);
    }
    update (_time: number, _delta: number): void {}

    destroy (): void
    {
        if (this.destroyed) return;
        this.destroyed = true;
        this.scene.events.off('shutdown', this.destroy, this);
        for (const cleanup of this.cleanups.splice(0)) cleanup();
        this.scene.tweens.killTweensOf(this.sprite);
        this.sprite.destroy();
    }
}
