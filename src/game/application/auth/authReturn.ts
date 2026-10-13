import type { GameStateSnapshot } from '../../state/gameStateSnapshot';
import type { TerminalResultState } from '../../state/terminalResultState';
import type { TelemetryPort } from '../telemetry/telemetry';

export type AccountOrigin = 'main-menu' | 'game-over' | 'game-menu';

export interface AuthReturnContext
{
    readonly snapshot: GameStateSnapshot | null;
    readonly telemetryContext: Readonly<{ sessionId: string; sessionStartedAt: number }> | null;
    readonly origin: AccountOrigin;
    readonly terminalResult: TerminalResultState | null;
}

export interface AuthReturnPort
{
    save(context: Readonly<AuthReturnContext>): boolean;
    take(): Readonly<AuthReturnContext> | null;
    clear(): void;
    getError(): string | null;
}

export function authReturnTelemetryContext (telemetry: TelemetryPort): AuthReturnContext['telemetryContext']
{
    return telemetry.getSessionContext();
}
