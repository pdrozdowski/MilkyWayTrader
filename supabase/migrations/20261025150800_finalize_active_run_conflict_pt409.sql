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
        raise exception 'Save revision conflict' using errcode = 'PT409';
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
