create table public.broken_run_saves (
    id bigint generated always as identity primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    run_id uuid,
    revision bigint not null default 0 check (revision >= 0),
    status text not null check (status in ('empty', 'active', 'terminal_pending')),
    snapshot jsonb,
    schema_version integer,
    updated_at timestamptz not null default now(),
    replay_metadata jsonb not null default '[]'::jsonb check (jsonb_typeof(replay_metadata) = 'array' and jsonb_array_length(replay_metadata) <= 16),
    unique (user_id, run_id),
    check ((status = 'empty' and run_id is null and snapshot is null and schema_version is null)
        or (status <> 'empty' and run_id is not null and snapshot is not null and schema_version is not null))
);

alter table public.broken_run_saves enable row level security;
revoke all on table public.broken_run_saves from anon, authenticated;

create or replace function public.load_active_run()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare caller uuid := public.require_save_owner(); result jsonb;
begin
    select jsonb_build_object('owner_id', caller, 'run_id', s.run_id, 'revision', s.revision, 'status', s.status,
        'snapshot', s.snapshot, 'schema_version', s.schema_version, 'updated_at', s.updated_at, 'replay_metadata', s.replay_metadata)
    into result from public.active_run_saves s where s.user_id = caller;
    return coalesce(result, jsonb_build_object('owner_id', caller, 'run_id', null, 'revision', 0, 'status', 'empty', 'snapshot', null, 'schema_version', null, 'replay_metadata', '[]'::jsonb));
end;
$$;

create or replace function public.save_broken_run(
    owner_id uuid,
    run_id uuid,
    revision bigint,
    status text,
    snapshot jsonb,
    schema_version integer,
    updated_at timestamptz,
    replay_metadata jsonb
) returns void language plpgsql security definer set search_path = '' as $$
declare caller uuid := public.require_save_owner();
begin
    if owner_id is distinct from caller then raise exception 'Save owner mismatch' using errcode = '42501'; end if;
    if run_id is null or revision is null or revision < 0 or status is null or status not in ('active', 'terminal_pending')
        or snapshot is null or schema_version is null or updated_at is null or replay_metadata is null then
        raise exception 'Invalid broken save payload' using errcode = '22023';
    end if;
    insert into public.broken_run_saves(user_id, run_id, revision, status, snapshot, schema_version, updated_at, replay_metadata)
    values(caller, run_id, revision, status, snapshot, schema_version, updated_at, replay_metadata)
    on conflict (user_id, run_id) do nothing;
end;
$$;

revoke all on function public.load_active_run() from public, anon;
grant execute on function public.load_active_run() to authenticated;
revoke all on function public.save_broken_run(uuid,uuid,bigint,text,jsonb,integer,timestamptz,jsonb) from public, anon;
grant execute on function public.save_broken_run(uuid,uuid,bigint,text,jsonb,integer,timestamptz,jsonb) to authenticated;
