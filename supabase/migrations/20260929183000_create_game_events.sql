-- Raw gameplay telemetry is deliberately isolated from browser database roles.
create extension if not exists pgcrypto;
create extension if not exists pg_cron with schema extensions;

create table public.game_events (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    anonymous_id uuid not null,
    user_id uuid null references auth.users(id) on delete set null,
    session_id uuid not null,
    event_name varchar(64) not null,
    event_data jsonb not null default '{}'::jsonb,
    game_version varchar(64) not null,
    platform varchar(16) not null,
    constraint game_events_event_name_not_empty check (char_length(event_name) between 1 and 64),
    constraint game_events_event_data_object check (jsonb_typeof(event_data) = 'object'),
    constraint game_events_game_version_not_empty check (char_length(game_version) between 1 and 64),
    constraint game_events_platform_allowed check (platform in ('desktop', 'mobile'))
);

create index game_events_created_at_idx on public.game_events (created_at);
create index game_events_session_id_idx on public.game_events (session_id);
create index game_events_anonymous_id_idx on public.game_events (anonymous_id);
create index game_events_user_id_idx on public.game_events (user_id);
create index game_events_event_name_idx on public.game_events (event_name);

alter table public.game_events enable row level security;
revoke all on table public.game_events from anon, authenticated;

-- One bounded batch per daily run avoids a long lock if retention has fallen behind.
create function public.delete_expired_game_events()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    deleted_count integer;
begin
    with expired as (
        select id
        from public.game_events
        where created_at < now() - interval '90 days'
        order by created_at
        limit 10000
    ), deleted as (
        delete from public.game_events events
        using expired
        where events.id = expired.id
        returning 1
    )
    select count(*) into deleted_count from deleted;

    return deleted_count;
end;
$$;

revoke all on function public.delete_expired_game_events() from public;

select cron.schedule(
    'delete-expired-game-events',
    '17 3 * * *',
    'select public.delete_expired_game_events();'
);
