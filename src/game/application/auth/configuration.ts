export interface PublicAuthConfiguration
{
    url?: string;
    publishableKey?: string;
}

export const gameVersion = import.meta.env.VITE_GAME_VERSION;

export function browserAuthConfiguration (): PublicAuthConfiguration
{
    return {
        url: import.meta.env.VITE_SUPABASE_URL,
        publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
    };
}
