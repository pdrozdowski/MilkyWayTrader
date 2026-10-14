alter table public.run_results
    add column final_score bigint,
    add constraint run_results_final_score_non_negative check (final_score is null or final_score >= 0);

create table public.global_player_scores (
    user_id uuid primary key references auth.users(id) on delete cascade,
    score bigint not null check (score >= 0),
    achieved_at timestamptz not null default now()
);

create index global_player_scores_score_idx on public.global_player_scores (score desc);
alter table public.global_player_scores enable row level security;
revoke all on table public.global_player_scores from anon, authenticated;

create or replace function public.submit_global_score(submitted_score bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if auth.uid() is null then
        raise exception 'Authentication required' using errcode = '42501';
    end if;
    if submitted_score is null or submitted_score < 0 then
        raise exception 'Invalid score' using errcode = '22023';
    end if;

    insert into public.global_player_scores (user_id, score)
    values (auth.uid(), submitted_score)
    on conflict (user_id) do update
        set score = excluded.score, achieved_at = now()
        where excluded.score > global_player_scores.score;
end;
$$;
revoke all on function public.submit_global_score(bigint) from public, anon;
grant execute on function public.submit_global_score(bigint) to authenticated;

create or replace function public.global_high_scores()
returns table (rank bigint, nickname text, achieved_at timestamptz, score bigint)
language sql
stable
security definer
set search_path = ''
as $$
    with ranked as (
        select rank() over (order by s.score desc) as rank,
               p.nickname, s.achieved_at, s.score
        from public.global_player_scores s
        join public.player_profiles p on p.user_id = s.user_id
    )
    select ranked.rank, ranked.nickname, ranked.achieved_at, ranked.score
    from ranked
    where ranked.rank <= 100
    order by ranked.rank, ranked.nickname;
$$;
revoke all on function public.global_high_scores() from public;
grant execute on function public.global_high_scores() to anon, authenticated;

create or replace function public.global_score_rank(personal_score bigint)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    caller uuid := auth.uid();
    result_rank bigint;
begin
    if caller is null then
        raise exception 'Authentication required' using errcode = '42501';
    end if;
    if personal_score is null or personal_score < 0 then
        raise exception 'Invalid score' using errcode = '22023';
    end if;

    select 1 + count(*) into result_rank
    from public.global_player_scores s
    where s.user_id <> caller and s.score > personal_score;
    return result_rank;
end;
$$;
revoke all on function public.global_score_rank(bigint) from public, anon;
grant execute on function public.global_score_rank(bigint) to authenticated;
