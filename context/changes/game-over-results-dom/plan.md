# Plan: expose and align game-over results

## Scope

1. Add an accessible game-over results section with direct references for the outcome, survived time, and final cash.
2. Populate and clear it from existing game-over lifecycle events.
3. Replace the Phaser-only result panel with the DOM presentation and share its width with the top-centred save-status notice.

## Verification

- Run TypeScript type checking.
- Run the narrow UI presentation test group and inspect the production build.

## Progress

- [x] Implement
- [x] Verify — `npm.cmd run typecheck` and `npm.cmd run build-nolog` passed. Browser screenshot gate could not run because the in-app browser connection rejected the sandbox metadata.
