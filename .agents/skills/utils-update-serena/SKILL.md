---
name: utils-update-serena
description: Refresh Serena's MilkyWayTrader code index and reconcile its project memories with current foundation documentation and archived change records. Use when asked to refresh, rescan, or update Serena's project knowledge or memories.
---

# Update Serena's Project Knowledge

Run from the MilkyWayTrader repository root. This skill updates Serena's external project memories; it does not edit repository documentation or archived change files.

## 1. Confirm Serena and project

1. Read Serena's initial instructions if they have not been read in this conversation.
2. Resolve the repository root and activate that project with Serena's `activate_project` tool when available. Do not activate a similarly named project from another directory.
3. Run `serena project index .` from the repository root to refresh Serena's language-server symbol cache. Do not create or edit `.serena/project.yml` as part of this operation.
4. Confirm `get_current_config` reports this project active and its language server ready. If indexing fails because the CLI cannot spawn its language server but Serena MCP reports a ready TypeScript server, enumerate project TypeScript/JavaScript source files (excluding dependencies, generated output, and worktrees) and call `get_symbols_overview` on every file. Report this as an MCP semantic rescan, not as a successful CLI index rebuild. If neither path can scan the code, report the exact error and do not claim a rescan.
5. Verify the refreshed view by querying representative entrypoints and their referenced symbols. Report source changes only when Git status/history or the scanned content proves them; otherwise report the rescan without claiming whether code changed.

Do not restart or reconfigure Serena's server unless the user asks or Serena reports a stale/unavailable language server. Do not use undocumented cache deletion or index-reset commands.

## 2. Scan project documentation

Scan every Markdown file under both `context/foundation/` and `context/archive/`, including nested files. Use the filesystem or Serena file-reading tools to enumerate and read the actual files; a filename listing or Git diff alone is not a documentation scan. Report unreadable or omitted files instead of claiming a complete scan.

Treat sources according to the repository's authority rules:

- `context/foundation/` contains current project guidance. Read `context/foundation/README.md` and `context/foundation/architecture.md` first, then reconcile the remaining foundation documents and any cross-references.
- `context/archive/` contains immutable historical records. Read the archived change records for lasting rationale and decisions that clarify current architecture or conventions. Never edit, move, or reclassify archive files. Archived requirements and plans do not override current foundation documents or the PRD.
- When an archived decision conflicts with current foundation guidance, keep the current guidance authoritative and retain the archive detail only as historical context.

## 3. Reconcile Serena memories

1. Call `list_memories`, then read `memory_maintenance`, `core`, and each existing memory relevant to the documentation scanned. Follow the memory graph references rather than creating duplicate topic memories.
2. Compare the memories with the current foundation documents and relevant archive evidence. Keep only stable, non-obvious facts that will prevent rediscovery; do not copy whole documents, transient task status, line-level details, or secrets into memories.
3. Update the narrowest relevant existing memory with `edit_memory` when a precise change is possible. If replacing a memory, read it first and preserve unrelated valid content. Create a new topic memory only when the information is durable and does not fit an existing memory.
4. Keep the `mem:` references in backticks and preserve the project's progressive-discovery graph. Do not delete or rename memories unless explicitly requested.
5. If the sources conflict, are ambiguous, or a required memory write fails, preserve existing memory content and report the conflict/error for the user. Do not resolve product decisions by guessing.

## 4. Verify and report

Re-read each changed memory and verify that its statements match the authoritative documentation and that its `mem:` references still point to listed memories. Report:

- whether Serena's project index refresh succeeded and which project/server was active;
- counts of Markdown files scanned in `context/foundation/` and `context/archive/`, plus any files not read;
- names of memories updated or created, or state that none needed changes;
- unresolved source conflicts or failed memory operations.

Do not write changes into repository files or commit, push, or deploy during a knowledge refresh.
