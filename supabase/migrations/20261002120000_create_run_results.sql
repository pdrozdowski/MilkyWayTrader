create table public.run_results (
    run_id uuid primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    outcome text not null,
    active_elapsed_ms bigint not null,
    final_credits bigint not null,
    created_at timestamptz not null default now(),
    constraint run_results_outcome_allowed check (outcome in ('death')),
    constraint run_results_active_elapsed_ms_non_negative check (active_elapsed_ms >= 0),
    constraint run_results_final_credits_non_negative check (final_credits >= 0)
);

alter table public.run_results enable row level security;
revoke all on table public.run_results from anon, authenticated;
grant insert, select on table public.run_results to authenticated;

create policy "Authenticated users insert their own run results"
on public.run_results
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Authenticated users select their own run results"
on public.run_results
for select
to authenticated
using (user_id = auth.uid());
