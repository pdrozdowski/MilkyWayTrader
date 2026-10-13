create table if not exists public.player_profiles (
    user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
    nickname text not null check (nickname ~ '^[A-Za-z0-9_]{3,20}$'),
    updated_at timestamptz not null default now()
);

alter table public.player_profiles enable row level security;
revoke all on table public.player_profiles from anon, authenticated;
grant select, insert, update on table public.player_profiles to authenticated;

create policy "Players can read their own profile"
    on public.player_profiles for select to authenticated
    using ((select auth.uid()) = user_id);

create policy "Players can create their own profile"
    on public.player_profiles for insert to authenticated
    with check ((select auth.uid()) = user_id);

create policy "Players can update their own profile"
    on public.player_profiles for update to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

create or replace function public.set_player_profiles_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger set_player_profiles_updated_at
    before update on public.player_profiles
    for each row execute function public.set_player_profiles_updated_at();
