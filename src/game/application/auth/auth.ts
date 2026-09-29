export type AuthStatus = 'unavailable' | 'unsigned' | 'signed-in' | 'error';

export interface AuthSnapshot
{
    status: AuthStatus;
    email: string | null;
    message: string | null;
}

export interface AuthPort
{
    getSnapshot(): Readonly<AuthSnapshot>;
    subscribe(listener: (snapshot: Readonly<AuthSnapshot>) => void): () => void;
    signInWithGoogle(): Promise<void>;
    signOut(): Promise<void>;
    getAccessToken?(): Promise<string | null>;
    destroy(): void;
}
