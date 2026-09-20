---
name: utils-refine-skill
description: Audit and polish one newly created MilkyWayTrader project skill after functional validation. Use for project skills under .agents/skills; it does not create the initial skill or change product code.
---

Pass the exact skill directory. Run the structural audit from the repository root:

```powershell
node .agents/skills/utils-refine-skill/scripts/audit-skill.mjs <skill-directory>
```

Read the generated report and [review checklist](references/review-checklist.md). Preserve the skill's requested outcome and permissions. Remove repeated repository rules, generic advice, stale scaffolding and unnecessary context; move conditional detail to focused references and repeated deterministic work to scripts. Repair broken links and make triggers, inputs, outputs, failure states and completion conditions explicit.

After edits, rerun the skill's focused tests and script syntax checks, then validate it with `quick_validate.py` from the installed `skill-creator`. Rerun the audit. Finish only when functional checks pass and no high- or medium-priority findings remain. Keep the final ignored report under `.cache/skill-refinement/`.

For this skill's one-time bootstrap, use `skill-creator`, validate it, then apply this workflow to its own directory. Do not commit, push, deploy or modify unrelated files.
