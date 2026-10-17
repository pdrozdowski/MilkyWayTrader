export const playerNicknamePattern = /^[A-Za-z0-9_]{3,20}$/;

export interface PlayerProfile
{
    readonly nickname: string;
}

export interface PlayerProfilePort
{
    loadOrCreate(suggestedNickname?: string, expectedOwnerId?: string): Promise<Readonly<PlayerProfile>>;
    updateNickname(nickname: string): Promise<Readonly<PlayerProfile>>;
}

export function generateDefaultPlayerNickname (random: () => number = Math.random): string
{
    return `spaceTrader${Math.floor(10000 + random() * 90000)}`;
}

export function normalizePlayerNickname (nickname: string): string
{
    const normalized = nickname.trim();
    if (!playerNicknamePattern.test(normalized)) throw new Error('Use 3–20 letters, numbers, or underscores.');
    return normalized;
}
