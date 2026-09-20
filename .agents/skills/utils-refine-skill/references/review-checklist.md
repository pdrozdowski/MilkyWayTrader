# Skill refinement checklist

## High priority

- The name, directory and YAML frontmatter disagree, required input is ambiguous, or the skill can perform an external mutation without the authorization required by repository rules.
- A referenced file is missing, an executable script is invalid, or the workflow cannot reach its stated result.
- The skill can loop without a progress-based stopping condition or can discard unrelated work.

## Medium priority

- The description routes unrelated work or fails to identify the intended request.
- `SKILL.md` repeats generic knowledge or repository guidance instead of linking the source of truth.
- Conditional detail is always loaded, deterministic repeated work is described instead of scripted, or errors lack actionable evidence.
- Success, blocked states, report locations or handoffs are unclear.

## Low priority

- Wording can be shorter without losing a decision, an example duplicates a contract, or UI metadata could better match the trigger.

Record concrete findings with severity, evidence and the applied change. Finish with the commands run and their outcomes. Do not invent findings to justify churn.
