create table public.active_run_saves (
    user_id uuid primary key references auth.users(id) on delete cascade,
    run_id uuid,
    revision bigint not null default 0 check (revision >= 0),
    status text not null check (status in ('empty', 'active', 'terminal_pending')),
    snapshot jsonb,
    schema_version integer,
    updated_at timestamptz not null default now(),
    replay_metadata jsonb not null default '[]'::jsonb check (jsonb_typeof(replay_metadata) = 'array' and jsonb_array_length(replay_metadata) <= 16),
    check ((status = 'empty' and run_id is null and snapshot is null and schema_version is null)
        or (status <> 'empty' and run_id is not null and snapshot is not null and schema_version is not null))
);

alter table public.active_run_saves enable row level security;
revoke all on table public.active_run_saves from anon, authenticated;

create or replace function public.require_save_owner()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare caller uuid := auth.uid();
begin
    if caller is null or auth.role() <> 'authenticated' then raise exception 'Authenticated owner required' using errcode = '42501'; end if;
    if not exists (select 1 from public.player_profiles p where p.user_id = caller) then raise exception 'Player profile required' using errcode = '42501'; end if;
    return caller;
end;
$$;
revoke all on function public.require_save_owner() from public, anon, authenticated;

create or replace function public.load_active_run()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare caller uuid := public.require_save_owner(); result jsonb;
begin
    select jsonb_build_object('owner_id', caller, 'run_id', s.run_id, 'revision', s.revision, 'status', s.status,
        'snapshot', s.snapshot, 'schema_version', s.schema_version, 'updated_at', s.updated_at)
    into result from public.active_run_saves s where s.user_id = caller;
    return coalesce(result, jsonb_build_object('owner_id', caller, 'run_id', null, 'revision', 0, 'status', 'empty', 'snapshot', null, 'schema_version', null));
end;
$$;

create or replace function public.mutate_active_run(
    operation text, expected_run_id uuid, expected_revision bigint, mutation_id uuid,
    next_run_id uuid default null, next_status text default null, next_snapshot jsonb default null, next_schema_version integer default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare caller uuid := public.require_save_owner(); slot_row public.active_run_saves%rowtype; replay jsonb; new_revision bigint; identity jsonb;
begin
    if mutation_id is null then raise exception 'Mutation id required' using errcode = '22023'; end if;
    insert into public.active_run_saves(user_id, status) values(caller, 'empty') on conflict(user_id) do nothing;
    select * into slot_row from public.active_run_saves s where s.user_id = caller for update;
    select value into replay from jsonb_array_elements(slot_row.replay_metadata) as entries(value) where value->>'mutation_id' = mutation_id::text limit 1;
    identity := jsonb_build_object('operation', operation, 'expected_run_id', expected_run_id, 'expected_revision', expected_revision,
        'next_run_id', next_run_id, 'next_status', next_status, 'next_snapshot', next_snapshot, 'next_schema_version', next_schema_version);
    if replay is not null then
        if replay->'identity' <> identity then raise exception 'Mutation payload mismatch' using errcode = '22023'; end if;
        return replay->'response';
    end if;
    if slot_row.revision <> expected_revision or slot_row.run_id is distinct from expected_run_id then
        raise exception 'Save revision conflict' using errcode = '40001', detail = jsonb_build_object('revision', slot_row.revision, 'run_id', slot_row.run_id)::text;
    end if;
    if operation = 'discard' then
        if slot_row.status = 'empty' then raise exception 'No save to discard' using errcode = 'P0002'; end if;
        next_run_id := null; next_status := 'empty'; next_snapshot := null; next_schema_version := null;
    elsif operation = 'create' then
        if slot_row.status <> 'empty' or next_run_id is null then raise exception 'Save slot is occupied' using errcode = '40001'; end if;
        next_status := 'active';
    elsif operation in ('save', 'mark_terminal') then
        if slot_row.status = 'empty' or next_run_id is distinct from slot_row.run_id then raise exception 'Run does not own active slot' using errcode = '40001'; end if;
        if operation = 'mark_terminal' then next_status := 'terminal_pending'; else next_status := 'active'; end if;
    else raise exception 'Unknown save operation' using errcode = '22023'; end if;
    if next_status = 'empty' then
        next_snapshot := null; next_schema_version := null; next_run_id := null;
    else
        if next_snapshot is null or jsonb_typeof(next_snapshot) <> 'object'
            or jsonb_typeof(next_snapshot->'schemaVersion') is distinct from 'number'
            or jsonb_typeof(next_snapshot->'credits') is distinct from 'number'
            or jsonb_typeof(next_snapshot->'clock') is distinct from 'object'
            or jsonb_typeof(next_snapshot->'clock'->'activeElapsedMs') is distinct from 'number'
            or jsonb_typeof(next_snapshot->'clock'->'budgetMs') is distinct from 'number'
            or next_schema_version is distinct from 20 then
            raise exception 'Invalid save payload' using errcode = '22023';
        end if;
        if next_snapshot->>'runId' is distinct from next_run_id::text
            or (next_snapshot->>'schemaVersion')::numeric <> next_schema_version
            or (next_snapshot->>'credits')::numeric < 0
            or (next_snapshot->'clock'->>'activeElapsedMs')::numeric < 0
            or (next_snapshot->'clock'->>'budgetMs')::numeric <= 0 then
            raise exception 'Invalid save payload' using errcode = '22023';
        end if;
    end if;
    new_revision := slot_row.revision + 1;
    update public.active_run_saves s set run_id = next_run_id, status = next_status, snapshot = next_snapshot,
        schema_version = next_schema_version, revision = new_revision, updated_at = now()
        where s.user_id = caller;
    replay := jsonb_build_object('revision', new_revision, 'run_id', next_run_id, 'status', next_status);
    update public.active_run_saves s set replay_metadata = (select coalesce(jsonb_agg(entry), '[]'::jsonb) from (
        select value as entry from jsonb_array_elements(s.replay_metadata) with ordinality e(value, ord) where value->>'mutation_id' <> mutation_id::text order by ord desc limit 15
    ) kept) || jsonb_build_array(jsonb_build_object('mutation_id', mutation_id, 'identity', identity, 'response', replay)) where s.user_id = caller;
    return replay;
end;
$$;

create or replace function public.finalize_active_run(
    expected_run_id uuid, expected_revision bigint, mutation_id uuid, outcome text,
    active_elapsed_ms bigint, final_credits bigint, final_score bigint
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare caller uuid := public.require_save_owner(); slot_row public.active_run_saves%rowtype; identity jsonb; replay jsonb;
    p_outcome alias for $4; p_active_elapsed_ms alias for $5; p_final_credits alias for $6; p_final_score alias for $7;
begin
    if expected_run_id is null or expected_revision is null or mutation_id is null or p_outcome is null
        or p_active_elapsed_ms is null or p_final_credits is null or p_final_score is null
        or p_outcome not in ('death','freedom','imprisonment','abandoned') or p_active_elapsed_ms < 0 or p_final_credits < 0 or p_final_score < 0 then
        raise exception 'Invalid finalization' using errcode = '22023';
    end if;
    insert into public.active_run_saves(user_id, status) values(caller, 'empty') on conflict(user_id) do nothing;
    select * into slot_row from public.active_run_saves s where s.user_id = caller for update;
    select value into replay from jsonb_array_elements(slot_row.replay_metadata) as entries(value) where value->>'mutation_id' = mutation_id::text limit 1;
    identity := jsonb_build_object('run_id', expected_run_id, 'expected_revision', expected_revision, 'outcome', p_outcome, 'active_elapsed_ms', p_active_elapsed_ms, 'final_credits', p_final_credits, 'final_score', p_final_score);
    if replay is not null then
        if replay->'identity' <> identity then raise exception 'Mutation payload mismatch' using errcode = '22023'; end if;
        return replay->'response';
    end if;
    if slot_row.revision <> expected_revision
        or (slot_row.status = 'empty' and (expected_revision <> 0 or slot_row.run_id is not null))
        or (slot_row.status <> 'empty' and slot_row.run_id is distinct from expected_run_id) then
        raise exception 'Save revision conflict' using errcode = '40001';
    end if;
    insert into public.run_results(run_id,user_id,outcome,active_elapsed_ms,final_credits,final_score)
    values(expected_run_id,caller,p_outcome,p_active_elapsed_ms,p_final_credits,p_final_score)
    on conflict(run_id) do nothing;
    if exists (select 1 from public.run_results r where r.run_id = expected_run_id and r.user_id = caller and
        (r.outcome <> p_outcome or r.active_elapsed_ms <> p_active_elapsed_ms or r.final_credits <> p_final_credits or r.final_score is distinct from p_final_score)) then
        raise exception 'Duplicate result payload mismatch' using errcode = '22023';
    end if;
    insert into public.global_player_scores(user_id,score) values(caller,final_score)
    on conflict(user_id) do update set score = excluded.score, achieved_at = now() where excluded.score > public.global_player_scores.score;
    update public.active_run_saves s set run_id = null, status = 'empty', snapshot = null, schema_version = null, revision = s.revision + 1, updated_at = now()
        where s.user_id = caller;
    replay := jsonb_build_object('status','saved','revision',slot_row.revision + 1);
    update public.active_run_saves s set replay_metadata = (select coalesce(jsonb_agg(entry), '[]'::jsonb) from (
        select value as entry from jsonb_array_elements(s.replay_metadata) with ordinality e(value, ord) where value->>'mutation_id' <> mutation_id::text order by ord desc limit 15
    ) kept) || jsonb_build_array(jsonb_build_object('mutation_id',mutation_id,'identity',identity,'response',replay)) where s.user_id = caller;
    return replay;
end;
$$;

create or replace function public.create_active_run(expected_revision bigint, mutation_id uuid, next_run_id uuid, next_snapshot jsonb, next_schema_version integer)
returns jsonb language sql security definer set search_path = '' as $$
    select public.mutate_active_run('create', null, expected_revision, mutation_id, next_run_id, 'active', next_snapshot, next_schema_version);
$$;
create or replace function public.save_active_run(expected_run_id uuid, expected_revision bigint, mutation_id uuid, next_snapshot jsonb, next_schema_version integer)
returns jsonb language sql security definer set search_path = '' as $$
    select public.mutate_active_run('save', expected_run_id, expected_revision, mutation_id, expected_run_id, 'active', next_snapshot, next_schema_version);
$$;
create or replace function public.mark_active_run_terminal(expected_run_id uuid, expected_revision bigint, mutation_id uuid, next_snapshot jsonb, next_schema_version integer)
returns jsonb language sql security definer set search_path = '' as $$
    select public.mutate_active_run('mark_terminal', expected_run_id, expected_revision, mutation_id, expected_run_id, 'terminal_pending', next_snapshot, next_schema_version);
$$;
create or replace function public.discard_active_run(expected_run_id uuid, expected_revision bigint, mutation_id uuid, confirmed boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
    if confirmed is not true then raise exception 'Explicit discard confirmation required' using errcode = '22023'; end if;
    return public.mutate_active_run('discard', expected_run_id, expected_revision, mutation_id, null, 'empty', null, null);
end;
$$;

revoke all on function public.create_active_run(bigint,uuid,uuid,jsonb,integer) from public, anon;
revoke all on function public.save_active_run(uuid,bigint,uuid,jsonb,integer) from public, anon;
revoke all on function public.mark_active_run_terminal(uuid,bigint,uuid,jsonb,integer) from public, anon;
revoke all on function public.discard_active_run(uuid,bigint,uuid,boolean) from public, anon;
grant execute on function public.create_active_run(bigint,uuid,uuid,jsonb,integer) to authenticated;
grant execute on function public.save_active_run(uuid,bigint,uuid,jsonb,integer) to authenticated;
grant execute on function public.mark_active_run_terminal(uuid,bigint,uuid,jsonb,integer) to authenticated;
grant execute on function public.discard_active_run(uuid,bigint,uuid,boolean) to authenticated;

revoke all on function public.load_active_run() from public, anon;
revoke all on function public.mutate_active_run(text,uuid,bigint,uuid,uuid,text,jsonb,integer) from public, anon;
revoke all on function public.mutate_active_run(text,uuid,bigint,uuid,uuid,text,jsonb,integer) from authenticated;
revoke all on function public.finalize_active_run(uuid,bigint,uuid,text,bigint,bigint,bigint) from public, anon;
grant execute on function public.load_active_run() to authenticated;
grant execute on function public.finalize_active_run(uuid,bigint,uuid,text,bigint,bigint,bigint) to authenticated;

alter table public.run_results drop constraint if exists run_results_outcome_allowed;
alter table public.run_results add constraint run_results_outcome_allowed check (outcome in ('death', 'freedom', 'imprisonment', 'abandoned'));
