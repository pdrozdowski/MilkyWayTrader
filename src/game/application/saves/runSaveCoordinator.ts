import type { GameStateSnapshot } from '../../state/gameStateSnapshot.ts';
import type { GameStateProvider } from '../gameStateProvider.ts';
import type { ActiveRunLoadResult, ActiveRunMutationResult, ActiveRunStorePort } from './activeRunStore.ts';
import type { PlayerEligibilityPort, PlayerEligibilitySnapshot } from '../auth/playerEligibility.ts';
import type { ResultStorePort } from '../results/resultStore.ts';
import type { PendingRunResultPort } from '../results/pendingRunResult.ts';
import { createTerminalScoreResult } from '../results/terminalScoreResult.ts';
import { persistOwnerResult, type OwnerResultDeliveryNotice } from '../results/resultDelivery.ts';

export interface SaveSchedulerPort
{
    now(): number;
    setTimeout(callback: () => void, delayMs: number): unknown;
    clearTimeout(handle: unknown): void;
}

export type RunSaveStatus = 'idle' | 'saving' | 'saved' | 'temporary-problem' | 'conflict' | 'ineligible' | 'failed';
export interface RunSaveNotice { readonly ownerId: string | null; readonly operationId: number; readonly status: RunSaveStatus; readonly message: string | null; }
export interface RunSaveCoordinatorOptions
{
    readonly provider: GameStateProvider;
    readonly store: ActiveRunStorePort;
    readonly resultStore?: ResultStorePort;
    readonly pendingResult?: PendingRunResultPort;
    readonly eligibility: PlayerEligibilityPort;
    readonly scheduler: SaveSchedulerPort;
    readonly createMutationId: () => string;
    readonly publish?: (notice: RunSaveNotice) => void;
    readonly publishResult?: (notice: OwnerResultDeliveryNotice) => void;
}

export function isMeaningfulDepartureChange (baseline: GameStateSnapshot, current: GameStateSnapshot): boolean
{
    return baseline.credits !== current.credits
        || baseline.shipUpgradeSpend !== current.shipUpgradeSpend
        || baseline.facilityUpgradeSpend !== current.facilityUpgradeSpend
        || JSON.stringify(baseline.cargo) !== JSON.stringify(current.cargo)
        || JSON.stringify(baseline.markets) !== JSON.stringify(current.markets)
        || baseline.shipStatus.cargoLevel !== current.shipStatus.cargoLevel
        || baseline.shipStatus.engineLevel !== current.shipStatus.engineLevel
        || baseline.shipStatus.weaponLevel !== current.shipStatus.weaponLevel
        || baseline.shipStatus.boosterUnlocked !== current.shipStatus.boosterUnlocked
        || baseline.shipStatus.currentHitPoints !== current.shipStatus.currentHitPoints;
}

export function crossedMinuteBoundary (before: number, after: number): boolean
{
    return Number.isFinite(before) && Number.isFinite(after) && after > before && Math.floor(after / 60_000) > Math.floor(before / 60_000);
}

export function createRunSaveCoordinator (options: RunSaveCoordinatorOptions): { requestSave(): void; startRun(): void; retryTerminal(): void; reloadAuthoritative(): void; destroy(): void }
{
    const { provider, store, eligibility, scheduler } = options;
    const publish = options.publish ?? (() => undefined);
    const createMutationId = options.createMutationId;
    let owner: string | null = null;
    let ownerLoaded = false;
    let activeRun = false;
    let ownerEpoch = 0;
    let revision = 0;
    let attachedRunId: string | null = null;
    let lastState = provider.snapshot();
    let landingBaseline: GameStateSnapshot | null = null;
    let latest: GameStateSnapshot | null = null;
    let pendingMutationSnapshot: GameStateSnapshot | null = null;
    let pendingMutationId: string | null = null;
    let inFlight = false;
    let blocked = false;
    let destroyed = false;
    let failures = 0;
    let retryTimer: unknown = null;
    let loadRetryTimer: unknown = null;
    let loadFailures = 0;
    let noticeTimer: unknown = null;
    let noticeOperation = 0;
    let terminalSnapshot: GameStateSnapshot | null = null;
    let terminalResult: ReturnType<typeof createTerminalScoreResult> | null = null;
    let terminalExpectedRevision: number | null = null;
    let durableTerminalRevision: number | null = null;
    let terminalRunning = false;
    let terminalRetryAllowed = false;
    let terminalMarkedOwner: string | null = null;
    let terminalMarkMutationId: string | null = null;
    let terminalDeliveryOperation = 0;

    const clearTimer = (timer: unknown): null => { if (timer !== null) scheduler.clearTimeout(timer); return null; };
    const notice = (status: RunSaveStatus, message: string | null = null): void => {
        const id = ++noticeOperation;
        if (noticeTimer !== null) noticeTimer = clearTimer(noticeTimer);
        publish({ ownerId: owner, operationId: id, status, message });
        if (status === 'saved' || status === 'temporary-problem') {
            noticeTimer = scheduler.setTimeout(() => {
                noticeTimer = null;
                if (!destroyed && id === noticeOperation) publish({ ownerId: owner, operationId: id, status: 'idle', message: null });
            }, 2000);
        }
    };
    const invalidate = (): void => {
        ownerEpoch++;
        latest = null;
        blocked = false;
        failures = 0;
        retryTimer = clearTimer(retryTimer);
        loadRetryTimer = clearTimer(loadRetryTimer);
        loadFailures = 0;
        noticeTimer = clearTimer(noticeTimer);
        notice('idle');
    };
    const isCurrent = (capturedOwner: string, capturedEpoch: number): boolean => !destroyed && owner === capturedOwner && ownerEpoch === capturedEpoch;
    const deliverTerminal = async (): Promise<void> => {
        if (!owner || !ownerLoaded || (!terminalSnapshot && !terminalResult) || terminalRunning || inFlight || !options.resultStore || !options.pendingResult) return;
        const capturedOwner = owner;
        const capturedEpoch = ownerEpoch;
        const snapshot = terminalSnapshot;
        const terminal = terminalResult ?? createTerminalScoreResult(snapshot!);
        terminalRunning = true;
        terminalRetryAllowed = false;
        try {
            const expectedRevision = terminalExpectedRevision ?? revision;
            if (durableTerminalRevision !== expectedRevision) {
                options.pendingResult.save(capturedOwner, { terminalResult: terminal, snapshot: snapshot!, expectedRevision });
                durableTerminalRevision = expectedRevision;
            }
            if (snapshot && attachedRunId === snapshot.runId && terminalMarkedOwner !== capturedOwner) {
                terminalMarkMutationId ??= createMutationId();
                const marked = await store.markTerminal(snapshot, expectedRevision, terminalMarkMutationId);
                if (!isCurrent(capturedOwner, capturedEpoch)) return;
                if (!marked.success) {
                    if (marked.kind === 'conflict') { blocked = true; notice('conflict', marked.message); return; }
                    throw new Error(marked.message);
                }
                revision = marked.acknowledgement.revision;
                terminalExpectedRevision = revision;
                terminalMarkedOwner = capturedOwner;
                terminalMarkMutationId = null;
                options.pendingResult.save(capturedOwner, { terminalResult: terminal, snapshot: snapshot!, expectedRevision: revision });
                durableTerminalRevision = revision;
            }
            const result = await persistOwnerResult(
                options.resultStore,
                terminal,
                terminalExpectedRevision ?? expectedRevision,
                capturedOwner,
                ++terminalDeliveryOperation,
                () => isCurrent(capturedOwner, capturedEpoch),
                options.publishResult ?? (() => undefined)
            );
            if (!isCurrent(capturedOwner, capturedEpoch)) return;
            if (result === null) return;
            if (result.status !== 'saved') {
                terminalRetryAllowed = true;
                notice(result.status === 'unsigned' ? 'ineligible' : 'failed', result.message);
                return;
            }
            options.pendingResult.clear(capturedOwner);
            attachedRunId = null;
            terminalResult = null;
            terminalSnapshot = null;
            terminalMarkedOwner = null;
            terminalExpectedRevision = null;
            durableTerminalRevision = null;
            notice('saved');
        } catch (error) {
            if (!isCurrent(capturedOwner, capturedEpoch)) return;
            terminalRetryAllowed = true;
            notice('failed', error instanceof Error ? error.message : 'Unable to retain the completed run.');
        } finally {
            terminalRunning = false;
            if (!destroyed && owner && owner !== capturedOwner && terminalResult) void deliverTerminal();
        }
    };

    const scheduleRetry = (): void => {
        if (retryTimer !== null || blocked || !latest || destroyed) return;
        const delay = failures < 5 ? 1000 : 30_000;
        retryTimer = scheduler.setTimeout(() => {
            retryTimer = null;
            void flush();
        }, delay);
    };
    const scheduleLoadRetry = (capturedOwner: string, capturedEpoch: number): void => {
        if (loadRetryTimer !== null || ownerLoaded || destroyed || !isCurrent(capturedOwner, capturedEpoch)) return;
        const delay = Math.min(1000 * (2 ** loadFailures), 30_000);
        loadFailures++;
        loadRetryTimer = scheduler.setTimeout(() => {
            loadRetryTimer = null;
            if (isCurrent(capturedOwner, capturedEpoch)) void loadOwner(eligibility.getSnapshot(), true);
        }, delay);
    };
    const flush = async (): Promise<void> => {
        if (destroyed || inFlight || blocked || !ownerLoaded || !latest || !owner) return;
        const currentOwner = owner;
        const capturedEpoch = ownerEpoch;
        const snapshot = latest;
        const nextRevision = revision;
        if (pendingMutationSnapshot !== snapshot || pendingMutationId === null) {
            pendingMutationSnapshot = snapshot;
            pendingMutationId = createMutationId();
        }
        const mutationId = pendingMutationId;
        inFlight = true;
        notice('saving');
        let result: ActiveRunMutationResult;
        try {
            result = attachedRunId === null
                ? await store.create(snapshot, nextRevision, mutationId)
                : await store.save(snapshot, nextRevision, mutationId);
        } catch (error) {
            result = { success: false as const, kind: 'unavailable' as const, message: error instanceof Error ? error.message : 'Unable to save the active run.' };
        }
        inFlight = false;
        if (!isCurrent(currentOwner, capturedEpoch)) { if (latest && owner) void flush(); return; }
        if (result.success) {
            if (pendingMutationSnapshot === snapshot) { pendingMutationSnapshot = null; pendingMutationId = null; }
            revision = result.acknowledgement.revision;
            attachedRunId = snapshot.runId;
            failures = 0;
            if (latest === snapshot) {
                latest = null;
                notice('saved');
            }
            if (terminalSnapshot) {
                terminalExpectedRevision = revision;
                if (owner && terminalResult && options.pendingResult) {
                    try {
                        options.pendingResult.save(owner, { terminalResult, snapshot: terminalSnapshot, expectedRevision: revision });
                        durableTerminalRevision = revision;
                    }
                    catch (error) { notice('failed', error instanceof Error ? error.message : 'Terminal recovery data could not be saved.'); }
                }
                void deliverTerminal();
            }
            else if (latest) void flush();
            return;
        }
        if (result.kind === 'conflict') {
            if (pendingMutationSnapshot === snapshot) { pendingMutationSnapshot = null; pendingMutationId = null; }
            blocked = true;
            retryTimer = clearTimer(retryTimer);
            notice('conflict', result.message);
            return;
        }
        if (result.kind !== 'unavailable') {
            blocked = true;
            retryTimer = clearTimer(retryTimer);
            notice(result.kind === 'ineligible' ? 'ineligible' : 'failed', result.message);
            return;
        }
        failures++;
        if (failures >= 5) notice('temporary-problem', result.message);
        if (terminalSnapshot) { retryTimer = clearTimer(retryTimer); void deliverTerminal(); return; }
        scheduleRetry();
    };

    const requestSave = (): void => {
        if (destroyed || blocked || !owner || terminalSnapshot || terminalResult) return;
        latest = provider.snapshot();
        retryTimer = clearTimer(retryTimer);
        void flush();
    };
    const reloadAuthoritative = async (): Promise<void> => {
        if (!owner || destroyed) return;
        const capturedOwner = owner;
        const capturedEpoch = ownerEpoch;
        let loaded: ActiveRunLoadResult;
        try { loaded = await store.load(); }
        catch (error) {
            if (isCurrent(capturedOwner, capturedEpoch)) { blocked = true; notice('failed', error instanceof Error ? error.message : 'Unable to reload the active run.'); }
            return;
        }
        if (!isCurrent(capturedOwner, capturedEpoch)) return;
        retryTimer = clearTimer(retryTimer);
        latest = null;
        blocked = false;
        if (loaded.status === 'active') {
            ownerLoaded = true;
            revision = loaded.revision;
            attachedRunId = loaded.snapshot.runId;
            lastState = loaded.snapshot;
            provider.restore(loaded.snapshot);
            notice('idle');
        } else if (loaded.status === 'empty') {
            ownerLoaded = true;
            revision = loaded.revision;
            attachedRunId = null;
            if (activeRun) requestSave();
            else notice('idle');
        } else if (loaded.status === 'terminal-pending') {
            ownerLoaded = true;
            revision = loaded.revision;
            attachedRunId = loaded.snapshot.runId;
            terminalSnapshot = loaded.snapshot;
            terminalResult = createTerminalScoreResult(loaded.snapshot);
            terminalExpectedRevision = loaded.revision;
            terminalMarkedOwner = capturedOwner;
            void deliverTerminal();
        } else if (loaded.status === 'incompatible') {
            ownerLoaded = true;
            blocked = true;
            notice('conflict', loaded.message);
        } else if (loaded.status === 'ineligible' || loaded.status === 'unavailable') {
            ownerLoaded = true;
            blocked = true;
            notice('ineligible', loaded.message);
        }
    };
    const loadOwner = async (eligibilitySnapshot: Readonly<PlayerEligibilitySnapshot>, retry = false): Promise<void> => {
        if (eligibilitySnapshot.status !== 'ready' || !eligibilitySnapshot.ownerId) {
            if (owner !== null) {
                invalidate();
                owner = null;
            }
            return;
        }
        const requestedOwner = eligibilitySnapshot.ownerId;
        if (requestedOwner !== owner) {
            invalidate();
            owner = requestedOwner;
            ownerLoaded = false;
            terminalMarkedOwner = null;
            terminalMarkMutationId = null;
            const currentState = provider.snapshot();
            terminalSnapshot = currentState.terminalResult ? currentState : null;
            terminalResult = currentState.terminalResult ? createTerminalScoreResult(currentState) : null;
            let pendingIntent = null;
            try { pendingIntent = options.pendingResult?.load(requestedOwner) ?? null; }
            catch (error) {
                blocked = true;
                notice('failed', error instanceof Error ? error.message : 'Terminal recovery data could not be read.');
                return;
            }
            if (pendingIntent) {
                terminalResult = pendingIntent.terminalResult;
                terminalSnapshot = pendingIntent.snapshot;
            }
            terminalExpectedRevision = pendingIntent?.expectedRevision ?? null;
            durableTerminalRevision = pendingIntent?.expectedRevision ?? null;
        } else if (!retry) return;
        const capturedEpoch = ownerEpoch;
        let loaded: ActiveRunLoadResult;
        try { loaded = await store.load(); }
        catch (error) {
            if (isCurrent(requestedOwner, capturedEpoch)) {
                notice('ineligible', error instanceof Error ? error.message : 'Unable to load the active run.');
                scheduleLoadRetry(requestedOwner, capturedEpoch);
            }
            return;
        }
        if (!isCurrent(requestedOwner, capturedEpoch)) return;
        if (loaded.status === 'empty') {
            loadRetryTimer = clearTimer(loadRetryTimer);
            loadFailures = 0;
            ownerLoaded = true;
            blocked = false;
            revision = loaded.revision;
            attachedRunId = null;
            if (terminalResult) void deliverTerminal();
            else if (activeRun) requestSave();
        } else if (loaded.status === 'active' && loaded.snapshot.runId === (terminalResult?.runId ?? provider.snapshot().runId)) {
            loadRetryTimer = clearTimer(loadRetryTimer);
            loadFailures = 0;
            ownerLoaded = true;
            blocked = false;
            revision = loaded.revision;
            attachedRunId = loaded.snapshot.runId;
            if (terminalResult) { terminalSnapshot ??= loaded.snapshot; void deliverTerminal(); }
            else if (activeRun) requestSave();
        } else if (loaded.status === 'terminal-pending') {
            loadRetryTimer = clearTimer(loadRetryTimer);
            loadFailures = 0;
            ownerLoaded = true;
            blocked = false;
            revision = loaded.revision;
            attachedRunId = loaded.snapshot.runId;
            terminalSnapshot = loaded.snapshot;
            terminalResult = createTerminalScoreResult(loaded.snapshot);
            terminalExpectedRevision = loaded.revision;
            terminalMarkedOwner = requestedOwner;
            void deliverTerminal();
        } else if (loaded.status === 'active' || loaded.status === 'incompatible') {
            loadRetryTimer = clearTimer(loadRetryTimer);
            ownerLoaded = true;
            blocked = true;
            notice('conflict', 'An account save must be resolved before this run can be attached.');
        } else if (loaded.status === 'unavailable') {
            notice('ineligible', loaded.message);
            scheduleLoadRetry(requestedOwner, capturedEpoch);
        } else if (loaded.status === 'ineligible') {
            notice('ineligible', loaded.message);
        }
    };
    const unsubscribeEligibility = eligibility.subscribe(snapshot => { void loadOwner(snapshot); });
    void loadOwner(eligibility.getSnapshot());

    const unsubscribeState = provider.subscribe(state => {
        const previous = lastState;
        lastState = state;
        if (!owner || blocked) return;
        if (state.runId !== attachedRunId && attachedRunId !== null) {
            blocked = true;
            notice('conflict', 'The active run changed before its save was resolved.');
            return;
        }
        if (state.terminalResult !== null) {
            retryTimer = clearTimer(retryTimer);
            latest = null;
            terminalSnapshot = state;
            terminalResult = createTerminalScoreResult(state);
            terminalExpectedRevision = revision;
            if (owner && options.pendingResult) {
                try { options.pendingResult.save(owner, { terminalResult, snapshot: state, expectedRevision: revision }); }
                catch (error) { notice('failed', error instanceof Error ? error.message : 'Terminal recovery data could not be saved.'); }
            }
            void deliverTerminal();
            return;
        }
        if (previous.terminalResult !== null) return;
        const landedBefore = previous.planetLifecycle.landedPlanetId;
        const landedNow = state.planetLifecycle.landedPlanetId;
        if (landedBefore === null && landedNow !== null) {
            landingBaseline = state;
            requestSave();
        } else if (landedBefore !== null && landedNow === null) {
            if (landingBaseline && isMeaningfulDepartureChange(landingBaseline, state)) requestSave();
            landingBaseline = null;
        }
        if (crossedMinuteBoundary(previous.clock.activeElapsedMs, state.clock.activeElapsedMs)) requestSave();
    });

    return {
        requestSave,
        startRun: () => {
            if (destroyed || activeRun) return;
            activeRun = true;
            const current = provider.snapshot();
            if (current.terminalResult) { terminalSnapshot = current; terminalResult = createTerminalScoreResult(current); }
            terminalExpectedRevision = revision;
            const eligibilitySnapshot = eligibility.getSnapshot();
            if (owner && eligibilitySnapshot.ownerId === owner && eligibilitySnapshot.status === 'ready') {
                if (terminalResult) void deliverTerminal();
                else requestSave();
            } else void loadOwner(eligibilitySnapshot);
        },
        retryTerminal: () => { if (terminalRetryAllowed) void deliverTerminal(); },
        reloadAuthoritative: () => { void reloadAuthoritative(); },
        destroy: () => {
            if (destroyed) return;
            destroyed = true;
            ownerEpoch++;
            retryTimer = clearTimer(retryTimer);
            loadRetryTimer = clearTimer(loadRetryTimer);
            noticeTimer = clearTimer(noticeTimer);
            unsubscribeState();
            unsubscribeEligibility();
        }
    };
}
