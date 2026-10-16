alter table public.run_results
    drop constraint run_results_outcome_allowed,
    add constraint run_results_outcome_allowed check (outcome in ('death', 'freedom', 'imprisonment'));
