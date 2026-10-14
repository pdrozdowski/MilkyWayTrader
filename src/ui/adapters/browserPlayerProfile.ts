import type { SupabaseClient } from '@supabase/supabase-js';
import type { PlayerProfile, PlayerProfilePort } from '../../game/application/playerProfile.ts';
import { generateDefaultPlayerNickname, normalizePlayerNickname } from '../../game/application/playerProfile.ts';

interface ProfileRow
{
    nickname: string;
}

interface ProfileQueryResult
{
    data: ProfileRow | null;
    error: { code?: string; message: string } | null;
}

interface PlayerProfileClient
{
    auth: { getUser(): Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }> };
    from(table: string): {
        select(columns: string): { maybeSingle(): Promise<ProfileQueryResult> };
        insert(values: Readonly<{ nickname: string }> & { user_id?: never }): { select(columns: string): { single(): Promise<ProfileQueryResult> } };
        update(values: Readonly<{ nickname: string }>): { eq(column: 'user_id', value: string): { select(columns: string): { single(): Promise<ProfileQueryResult> } } };
    };
}

function profileFrom (row: ProfileRow | null, message: string): Readonly<PlayerProfile>
{
    if (!row || typeof row.nickname !== 'string') throw new Error(message);
    return Object.freeze({ nickname: row.nickname });
}

export function createBrowserPlayerProfilePort (client: SupabaseClient): PlayerProfilePort
{
    const profileClient = client as unknown as PlayerProfileClient;
    return {
        loadOrCreate: async (suggestedNickname?: string) => {
            const existing = await profileClient.from('player_profiles').select('nickname').maybeSingle();
            if (existing.error) throw new Error(existing.error.message);
            if (existing.data) return profileFrom(existing.data, 'Player profile is unavailable.');

            const created = await profileClient.from('player_profiles').insert({ nickname: suggestedNickname ?? generateDefaultPlayerNickname() }).select('nickname').single();
            if (!created.error) return profileFrom(created.data, 'Player profile could not be created.');

            const raced = await profileClient.from('player_profiles').select('nickname').maybeSingle();
            if (raced.error || !raced.data) throw new Error(created.error.message);
            return profileFrom(raced.data, 'Player profile could not be created.');
        },
        updateNickname: async nickname => {
            const currentUser = await profileClient.auth.getUser();
            if (currentUser.error || !currentUser.data.user) throw new Error(currentUser.error?.message ?? 'Signed-in player is unavailable.');
            const updated = await profileClient.from('player_profiles').update({ nickname: normalizePlayerNickname(nickname) }).eq('user_id', currentUser.data.user.id).select('nickname').single();
            if (updated.error) throw new Error(updated.error.message);
            return profileFrom(updated.data, 'Player nickname could not be updated.');
        }
    };
}
