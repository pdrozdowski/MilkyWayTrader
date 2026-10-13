---
name: cicd-dev-deploy-supabase
description: Apply pending database migrations to the Supabase development/test project configured in .env.local. Use when the user asks to deploy Supabase tables for development or feature testing; never use for production.
---

# Supabase development migration deploy

Use only for an explicitly requested development/test schema deployment. The repository designates .env.local as the remote Supabase test project; .env.test is reserved for local Docker tests.

From the repository root, run:
    npx supabase link --project-ref fotwbqexraxlqqmcgfpa
    node .agents/skills/cicd-dev-deploy-supabase/scripts/deploy.mjs --target test

The script checks that .env.local and Supabase CLI link metadata identify the same project, rejects production-like project names and production env-file matches, then refreshes the Supabase CLI link for the matching project before running db push with all pending local migrations. Linking supplies the remote IPv4 database configuration required on networks without IPv6.

Use --dry-run to preview pending migrations. Do not switch to a production project or bypass a failed target check. On CLI, connectivity, or authentication failure, report the error and stop; do not retry automatically. Never display or copy credentials.
