# Frame Brief: Environmental hazards and death

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

The game already presents collision effects for a ship hitting an asteroid or
the star. S-07 must establish their effect on ship HP. At HP <= 0, the ship
must break apart, show an end-game screen with the result, retain the finished
game in the database, and offer high-score access.

## Initial Framing (preserved)

- **User's stated cause or approach**: Determine collision damage and close the game cycle after player death.
- **User's proposed direction**: On zero HP, destroy the ship, show the game-over result, save the finished state, and provide high-score access.
- **Pre-dispatch narrowing**: The concern is one complete cycle: hazard damage plus closing a game after death.

## Dimension Map

The observation could originate at any of these dimensions:

1. **Collision damage resolution** — collision detection and feedback may exist without an authoritative HP consequence or a once-per-contact rule.
2. **Terminal-run lifecycle** — reaching zero HP may lack a one-way outcome that freezes the run and captures its final score.
3. **Finished-result retention and presentation** — a terminal record and result screen may be absent independently of collision damage.  
   <- initial framing

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Collision feedback is mistaken for damage resolution. | Ship collision is swept and produces knockback, control lock, timestamp, explosion, sound, and shake, but does not change `shipStatus.currentHitPoints`; mechanics tests explicitly expect unchanged HP. Moolaris contact only forces an outward velocity and has no impact/separation marker. [gameSimulation.ts](../../../src/game/mechanics/gameSimulation.ts:186), [contact.ts](../../../src/game/mechanics/moolaris/contact.ts:12), [gameScene.ts](../../../src/game/scenes/gameScene.ts:401) | STRONG |
| A zero-HP terminal run lifecycle already exists. | The snapshot has no terminal outcome/result field; the codec permits only the active-run aggregate; the game scene keeps advancing simulation. The standalone GameOver scene is not started by the active game, whose exit returns to MainMenu. [gameStateSnapshot.ts](../../../src/game/state/gameStateSnapshot.ts:12), [gameStateCodec.ts](../../../src/game/application/gameStateCodec.ts:89), [gameScene.ts](../../../src/game/scenes/gameScene.ts:328) | NONE |
| Finished results, persistence, and high-score presentation already support death. | Supabase contains telemetry only, not runs/results; browser integration is auth-only; GameOver renders a literal message and routes any click to MainMenu. No result/history/high-score UI or API exists. [20260929183000_create_game_events.sql](../../../supabase/migrations/20260929183000_create_game_events.sql:5), [browserAuth.ts](../../../src/ui/adapters/browserAuth.ts:34), [gameOverScene.ts](../../../src/game/scenes/gameOverScene.ts:22) | NONE |

## Narrowing Signals

- The user selected the death result and final score on the end-game screen, excluding navigation to the global high-score table.
- The user confirmed that every terminal outcome must produce a stored result containing survival time and final cash.
- The user clarified that this stored result is not a globally eligible high-score entry. PRD reserves the global table for authenticated freedom outcomes after the full time limit, while retained history may include death. [prd.md](../../foundation/prd.md:351)

## Cross-System Convention

The PRD separates a retained terminal result from public ranking: personal history retains every outcome, whereas the global table accepts only authenticated runs that survive the full active-time limit and achieve freedom. [prd.md](../../foundation/prd.md:357) The roadmap independently assigns S-14 only the later removal of an active save after a result is retained, so S-07 can establish result retention without implementing active-save deletion. [roadmap.md](../../foundation/roadmap.md:235)

## Reframed Problem Statement

> **The actual problem to plan around is**: create an authoritative environmental-hazard and death lifecycle that applies deterministic asteroid and sun damage to HP, resolves zero HP once into a frozen death result, presents that result, and retains every terminal result with its outcome, survival time, and final liquid cash—without implementing a global-score table or active-save deletion.

The initial framing correctly identified the player-visible journey, but it treated three missing contracts as one collision effect: damage, terminal state, and retained result. The plan must make the terminal record a distinct capability so a collision cannot create duplicate results or leave a dead run playable.

## Confidence

- **HIGH** — collision and presentation code prove the missing transitions; the persistence surface is absent; and the owner explicitly resolved the result-versus-global-ranking boundary.

## What Changes for /10x-plan

Plan a single death path from deterministic collision damage through a one-way terminal outcome, destroyed-ship/result presentation, and retained terminal-result record. Defer global high-score viewing/ranking and terminal active-save deletion to their dedicated slices.

## References

- Source files: [gameSimulation.ts](../../../src/game/mechanics/gameSimulation.ts:186), [gameStateSnapshot.ts](../../../src/game/state/gameStateSnapshot.ts:12), [gameOverScene.ts](../../../src/game/scenes/gameOverScene.ts:22)
- Product and roadmap: [prd.md](../../foundation/prd.md:344), [roadmap.md](../../foundation/roadmap.md:149)
- Investigation tasks: `/root/collision_damage`, `/root/terminal_lifecycle`, `/root/result_persistence`
