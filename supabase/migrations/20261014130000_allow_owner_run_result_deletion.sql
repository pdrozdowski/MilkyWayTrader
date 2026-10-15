grant delete on table public.run_results to authenticated;

create policy "Authenticated users delete their own run results"
on public.run_results
for delete
to authenticated
using (user_id = auth.uid());
