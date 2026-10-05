<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: S09 Asteroid Salvage Implementation Plan

- **Plan**: context/changes/s09-asteroid-salvage/plan.md
- **Scope**: Phase 1 of 4
- **Reviewed phases**: 1
- **Date**: 2026-10-05
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical 3 warnings 1 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

## Findings

### F1 — Roadmap references the wrong PRD capabilities

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: context/foundation/roadmap.md:52
- **Detail**: Phase 1 inserted S09 FR-037 through FR-039 and renumbered later PRD requirements, but the roadmap still assigns FR-037 through FR-039 to S10 and uses similarly stale references for S11 onward. The roadmap's scope anchor also ends at FR-046 although the PRD now ends at FR-049. Future plans based on those references would target unrelated capabilities.
- **Fix**: Update the affected roadmap milestone references and scope anchor to the current PRD numbering, including S09's added salvage FRs.
  - Strength: Restores the PRD-to-roadmap traceability used by later planning without changing product scope.
  - Tradeoff: Requires checking every affected repeated milestone reference.
  - Confidence: HIGH — the shifted numbering is directly visible in context/foundation/prd.md:202-220 and context/foundation/roadmap.md:52-58,177,189,201,213,225,237,249.
  - Blind spot: None significant.
- **Decision**: PENDING

### F2 — PRD retains legacy crate terminology

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/foundation/prd.md:48
- **Detail**: Phase 1 requires replacing legacy crate/cargo wording. The amended PRD correctly specifies orbital cargo and loose commodities in its salvage requirements, but its Guardrails, clock rule, and Non-Goals still refer to crate contents, crate motion/lifetimes, and salvage crates (lines 48, 251, 371-372). Those terms describe the retired flow and conflict with the new product contract.
- **Fix**: Replace each remaining crate reference with the applicable orbital-cargo or loose-item wording, preserving the existing intent.
- **Decision**: PENDING

### F3 — Spill and ship-targeted pickup are not explicitly proven

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: tests/domain/serotonMarket.test.mjs:68
- **Detail**: The Phase 1 automated criterion calls for preservation through spill residuals and proof that free pickup changes only the ship container it enters. The test proves generic partial/full transfer, free addition, and complete removal, but it does not split an orbital holder into one-unit loose items or execute a state-level ship pickup. Phase 2 owns those interactions, so this is a phase-boundary ambiguity, but the Phase 1 criterion is not yet demonstrably covered as written.
- **Fix**: Add focused state/domain coverage for proportional one-unit spill allocation with final residual and for a free pickup affecting only the receiving ship container, or explicitly move this criterion to Phase 2.
- **Decision**: PENDING

### F4 — Codec permits empty commodity holders

- **Severity**: OBSERVATION
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/game/application/gameStateCodec.ts:114
- **Detail**: The codec accepts quantity-zero containers for ship cargo and orbital cargo as long as totalCost is zero. This is non-canonical for an orbital cargo entity, whose planned spawn quantity is one through twenty, and leaves redundant empty ship entries valid. It does not currently create a security or data-loss risk.
- **Fix**: Define the canonical empty-holder rule; reject zero-quantity material holders in the codec or remove them in reducers while retaining zero total cost for any permitted empty representation.
  - Strength: Makes snapshot states unambiguous before later salvage mechanics consume them.
  - Tradeoff: Requires choosing whether an empty holder is representable at all.
  - Confidence: MEDIUM — the container rule is clear, but future Phase 2 interaction needs may choose the representation.
  - Blind spot: Phase 2's final reducer design is not yet implemented.
- **Decision**: PENDING
