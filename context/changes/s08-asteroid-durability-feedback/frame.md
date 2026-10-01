# Frame Brief: Asteroid durability and collision feedback

## Reported Observation

Asteroids currently fragment on one projectile hit, planet collisions look unrealistic and have no distinct feedback, and star collisions disappear too abruptly.

## Confirmed Product Direction

- BIG asteroids require three projectile hits; MEDIUM require two; SMALL require one.
- Remaining asteroid durability is persisted and shown by a compact health bar.
- A boosted ship impact applies the existing Moolaris warning and disables boost/control.
- Planet impacts fragment asteroids once they reach the requested deeper boundary and use a distinct impact visual.
- Star impacts pull asteroids toward the star center beneath its visual layer, removing them within half the star radius.

## Reframed Problem Statement

Extend the authoritative asteroid lifecycle with persistent durability and collision-specific transition data, while keeping the mechanics pure and deriving all visual feedback in Phaser from committed state transitions.
