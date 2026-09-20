---
name: 10x-prd-en-capability
description: Validate and normalize MilkyWayTrader PRDs so the complete document is English and every functional requirement describes one solution-independent capability. Use after /10x-prd and whenever context/foundation/prd.md is created, edited, or reviewed.
---

# English capability PRD gate

Use this skill as the final quality gate for `context/foundation/prd.md`. It reviews product wording; it does not make new product decisions.

## Workflow

1. Read the complete PRD and the canonical schema at `../10x-shape/references/prd-schema.md`.
2. Run the deterministic check from the repository root:

   ```powershell
   node .agents/skills/10x-prd-en-capability/scripts/check-prd.mjs context/foundation/prd.md
   ```

3. Review the whole document semantically:
   - All prose intended for readers is English. Proper names and code identifiers are allowed.
   - Each FR contains one actor and one independently testable product capability.
   - An FR states what the product enables, not a screen, control, storage shape, provider, formula, threshold, or implementation mechanism.
   - Conditions, calculations, presentation details, state transitions, and configuration belong in acceptance criteria, Business Logic, Access Control, NFRs, or Open Questions.
   - Closely related outputs may remain in one capability only when they cannot be delivered or tested independently. Do not reject every use of `and` mechanically.
4. If the current task authorizes PRD editing, fix violations without changing scope, priority, or product intent. Renumber FRs and update internal references when required. If a fix would choose new product behavior, stop and ask the user.
5. Rerun the deterministic check and repeat the semantic review.

## Completion

Finish only when the checker passes and the semantic review has no language, capability-boundary, or solution-leak findings. Report line-specific unresolved findings when blocked. A check-only or review request does not authorize editing.

