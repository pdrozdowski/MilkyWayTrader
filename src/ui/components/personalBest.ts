import { resultHistoryPageSize, type AuthPort, type AuthSnapshot, type PlayerProfile, type ResultHistoryRecord, type ResultHistoryStorePort, type UiHandle } from '../contracts';
import { displayLabels } from './displayLabels';
import { formatCredits } from './formatCredits';

interface PersonalBestOptions
{
    readonly store: ResultHistoryStorePort;
    readonly auth: AuthPort;
    readonly profilePort?: import('../contracts').PlayerProfilePort | null;
    readonly openAccount: (origin: 'game-menu' | 'game-over', returnFocus: HTMLElement) => void;
}

function required<T extends Element> (root: HTMLElement, selector: string): T
{
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing Personal Best control: ${selector}`);
    return element;
}

function dateLabel (savedAt: string): string
{
    const date = new Date(savedAt);
    if (!Number.isFinite(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date).toUpperCase();
}

function elapsedTimeLabel (activeElapsedMs: number): string
{
    const totalSeconds = Math.floor(activeElapsedMs / 1000);
    const seconds = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const minutes = totalMinutes % 60;
    const hours = Math.floor(totalMinutes / 60);
    const secondsLabel = `${String(seconds).padStart(2, '0')}${displayLabels.personalBestSecondsUnit}`;
    if (hours > 0) return `${hours}${displayLabels.personalBestHoursUnit} ${String(minutes).padStart(2, '0')}${displayLabels.personalBestMinutesUnit} ${secondsLabel}`;
    return `${totalMinutes}${displayLabels.personalBestMinutesUnit} ${secondsLabel}`;
}

function outcomeLabel (record: ResultHistoryRecord): string
{
    switch (record.outcome) {
        case 'freedom': return displayLabels.personalBestFreedom;
        case 'imprisonment': return displayLabels.personalBestPrison;
        case 'death': return displayLabels.personalBestDeath;
        case 'abandoned': return displayLabels.personalBestAbandoned;
    }
}

export function mountPersonalBest (root: HTMLElement, options: PersonalBestOptions): UiHandle
{
    const dialog = required<HTMLElement>(root, '#personal-best');
    const title = required<HTMLElement>(root, '#personal-best-title');
    const highScore = required<HTMLElement>(root, '#personal-best-high-score');
    const status = required<HTMLElement>(root, '#personal-best-status');
    const signIn = required<HTMLButtonElement>(root, '#personal-best-sign-in');
    const retry = required<HTMLButtonElement>(root, '#personal-best-retry');
    const clearHistory = required<HTMLButtonElement>(root, '#personal-best-clear-history');
    const confirmation = required<HTMLElement>(root, '#personal-best-confirmation');
    const confirmationTitle = required<HTMLElement>(root, '#personal-best-confirmation-title');
    const confirmationMessage = required<HTMLElement>(root, '#personal-best-confirmation-message');
    const confirmationError = required<HTMLElement>(root, '#personal-best-confirmation-error');
    const confirmationNo = required<HTMLButtonElement>(root, '#personal-best-confirmation-no');
    const confirmationYes = required<HTMLButtonElement>(root, '#personal-best-confirmation-yes');
    const table = required<HTMLTableElement>(root, '#personal-best-table');
    const rows = required<HTMLTableSectionElement>(root, '#personal-best-rows');
    const headings = [required<HTMLElement>(root, '#personal-best-date-heading'), required<HTMLElement>(root, '#personal-best-elapsed-heading'), required<HTMLElement>(root, '#personal-best-score-heading'), required<HTMLElement>(root, '#personal-best-outcome-heading'), required<HTMLElement>(root, '#personal-best-best-heading'), required<HTMLElement>(root, '#personal-best-delete-heading')];
    const previous = required<HTMLButtonElement>(root, '#personal-best-previous');
    const next = required<HTMLButtonElement>(root, '#personal-best-next');
    const indicator = required<HTMLElement>(root, '#personal-best-page-indicator');
    const close = required<HTMLButtonElement>(root, '#personal-best-close');
    const menuTrigger = required<HTMLButtonElement>(root, '#game-menu-personal-best');
    const gameOverTrigger = required<HTMLButtonElement>(root, '#game-over-personal-best');
    let authSnapshot: Readonly<AuthSnapshot> = options.auth.getSnapshot();
    let page = 0;
    let records: readonly ResultHistoryRecord[] = [];
    let best: ResultHistoryRecord | null = null;
    let profile: Readonly<PlayerProfile> | null = null;
    let totalCount = 0;
    let loading = false;
    let error: string | null = null;
    let returnFocus: HTMLElement | null = null;
    let accountOrigin: 'game-menu' | 'game-over' = 'game-menu';
    let request = 0;
    let destroyed = false;
    let mutationPending = false;
    let mutationError: string | null = null;
    let confirmationRecord: ResultHistoryRecord | null = null;
    let confirmationTrigger: HTMLElement | null = null;

    const clearData = (): void => { records = []; best = null; totalCount = 0; page = 0; };
    const render = (): void => {
        title.textContent = `\u{1F3C6} ${profile?.nickname ?? displayLabels.personalBestNicknameFallback} \u2014 ${displayLabels.personalBest} \u{1F3C6}`;
        highScore.textContent = best?.finalScore !== null && best ? formatCredits(best.finalScore) : '';
        highScore.hidden = !best;
        const bestDate = root.querySelector<HTMLElement>('#personal-best-best-date');
        if (bestDate) bestDate.textContent = best ? dateLabel(best.savedAt) : '';
        const runCount = root.querySelector<HTMLElement>('#personal-best-run-count');
        if (runCount) runCount.textContent = `${totalCount} runs`;
        headings.forEach((heading, index) => { heading.textContent = [displayLabels.personalBestDate, displayLabels.personalBestElapsed, displayLabels.personalBestScore, displayLabels.personalBestOutcome, '', ''][index]; });
        const signedIn = authSnapshot.status === 'signed-in';
        const populated = signedIn && !loading && !error && totalCount > 0;
        table.hidden = !populated;
        status.textContent = !signedIn ? displayLabels.personalBestSignInPrompt : loading ? displayLabels.personalBestLoading : error ? `${displayLabels.personalBestLoadFailed} ${error}` : totalCount === 0 ? displayLabels.personalBestNoScores : '';
        signIn.hidden = signedIn;
        signIn.textContent = displayLabels.accountGoogleSignIn;
        signIn.disabled = authSnapshot.status === 'unavailable';
        retry.hidden = !signedIn || !error;
        retry.textContent = displayLabels.personalBestRetry;
        clearHistory.textContent = displayLabels.personalBestClearHistory;
        clearHistory.hidden = !signedIn;
        clearHistory.disabled = loading || totalCount === 0 || mutationPending;
        const pageCount = Math.max(1, Math.ceil(totalCount / resultHistoryPageSize));
        indicator.textContent = `${page + 1} / ${pageCount}`;
        previous.textContent = displayLabels.personalBestPrevious;
        next.textContent = displayLabels.personalBestNext;
        previous.disabled = !populated || page <= 0 || loading;
        next.disabled = !populated || page >= pageCount - 1 || loading;
        close.textContent = displayLabels.personalBestClose;
        confirmation.hidden = !confirmationTrigger;
        confirmationTitle.textContent = confirmationRecord ? displayLabels.personalBestConfirmDeleteTitle : displayLabels.personalBestConfirmClearTitle;
        confirmationMessage.textContent = confirmationRecord
            ? displayLabels.personalBestConfirmDeleteMessage.replace('{score}', formatCredits(confirmationRecord.finalScore ?? confirmationRecord.finalCredits)).replace('{date}', dateLabel(confirmationRecord.savedAt)).replace('{outcome}', outcomeLabel(confirmationRecord))
            : displayLabels.personalBestConfirmClearMessage.replace('{count}', String(totalCount));
        confirmationError.textContent = mutationError ?? '';
        confirmationNo.textContent = displayLabels.personalBestConfirmNo;
        confirmationYes.textContent = displayLabels.personalBestConfirmYes;
        confirmationNo.disabled = mutationPending;
        confirmationYes.disabled = mutationPending;
        rows.replaceChildren();
        for (let index = 0; index < resultHistoryPageSize; index++) {
            const record = records[index];
            const row = document.createElement('tr');
            if (!record) {
                row.setAttribute('class', 'personal-best-empty-row');
                for (let cellIndex = 0; cellIndex < 6; cellIndex++) row.append(document.createElement('td'));
                rows.append(row);
                continue;
            }
            const values = [dateLabel(record.savedAt), elapsedTimeLabel(record.activeElapsedMs), formatCredits(record.finalScore ?? record.finalCredits), outcomeLabel(record), best?.runId === record.runId ? displayLabels.personalBestBest : ''];
            values.forEach(value => { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); });
            if (best?.runId === record.runId) row.setAttribute('data-personal-best', 'true');
            const deleteCell = document.createElement('td');
            const deleteButton = document.createElement('button');
            deleteButton.type = 'button'; deleteButton.textContent = ''; deleteButton.className = 'personal-best-delete'; deleteButton.setAttribute('aria-label', `${displayLabels.personalBestDelete} ${formatCredits(record.finalScore ?? record.finalCredits)} ${dateLabel(record.savedAt)}`);
            deleteButton.disabled = loading || mutationPending;
            deleteButton.addEventListener('click', () => openConfirmation(record, deleteButton));
            deleteCell.append(deleteButton); row.append(deleteCell); rows.append(row);
        }
    };
    const openConfirmation = (record: ResultHistoryRecord | null, trigger: HTMLElement): void => {
        if (authSnapshot.status !== 'signed-in' || loading || mutationPending) return;
        confirmationRecord = record;
        confirmationTrigger = trigger;
        mutationError = null;
        render();
        confirmationYes.focus();
    };
    const closeConfirmation = (restoreFocus: boolean): void => {
        if (!confirmationTrigger || mutationPending) return;
        const trigger = confirmationTrigger;
        const record = confirmationRecord;
        const rowIndex = record ? records.findIndex(item => item.runId === record.runId) : -1;
        confirmationTrigger = null;
        confirmationRecord = null;
        mutationError = null;
        render();
        if (restoreFocus) {
            const currentRowButton = record ? rows.querySelectorAll<HTMLButtonElement>('button')[rowIndex] : null;
            (currentRowButton ?? (trigger.isConnected ? trigger : clearHistory)).focus();
        }
    };
    const confirmMutation = async (): Promise<void> => {
        if (!confirmationTrigger || mutationPending || authSnapshot.status !== 'signed-in') return;
        const record = confirmationRecord;
        const identity = authSnapshot.email;
        const operation = ++request;
        const index = record ? records.findIndex(item => item.runId === record.runId) : -1;
        mutationPending = true;
        mutationError = null;
        render();
        try {
            const result = record ? await options.store.deleteResult(record.runId) : await options.store.clearHistory();
            if (destroyed || operation !== request || authSnapshot.status !== 'signed-in' || authSnapshot.email !== identity) return;
            if (!result.success) {
                mutationPending = false;
                mutationError = result.error || displayLabels.personalBestMutationFailed;
                render();
                return;
            }
            const nextCount = record ? Math.max(0, totalCount - 1) : 0;
            page = record ? Math.min(page, Math.max(0, Math.ceil(nextCount / resultHistoryPageSize) - 1)) : 0;
            mutationPending = false;
            mutationError = null;
            confirmationTrigger = null;
            confirmationRecord = null;
            await load();
            if (destroyed || authSnapshot.status !== 'signed-in' || authSnapshot.email !== identity) return;
            if (!record || records.length === 0) close.focus();
            else {
                const buttons = rows.querySelectorAll<HTMLButtonElement>('button');
                const target = buttons[Math.min(Math.max(index, 0), buttons.length - 1)];
                (target ?? close).focus();
            }
        } catch (mutationFailure) {
            if (destroyed || operation !== request || authSnapshot.status !== 'signed-in' || authSnapshot.email !== identity) return;
            mutationPending = false;
            mutationError = mutationFailure instanceof Error ? mutationFailure.message : displayLabels.personalBestMutationFailed;
            if (!mutationError) mutationError = displayLabels.personalBestMutationFailed;
            render();
        }
    };
    const load = async (): Promise<void> => {
        if (authSnapshot.status !== 'signed-in') { clearData(); loading = false; error = null; render(); return; }
        const operation = ++request;
        loading = true; error = null; render();
        try {
            const [pageResult, bestResult] = await Promise.all([options.store.getPage(page), options.store.getBest()]);
            if (destroyed || operation !== request || authSnapshot.status !== 'signed-in') return;
            loading = false;
            if (pageResult.error || !pageResult.data || bestResult.error) { error = pageResult.error ?? bestResult.error ?? displayLabels.personalBestLoadFailed; clearData(); }
            else { records = pageResult.data.records; totalCount = pageResult.data.totalCount; best = bestResult.data; }
        } catch (loadError) {
            if (destroyed || operation !== request || authSnapshot.status !== 'signed-in') return;
            loading = false; clearData(); error = loadError instanceof Error ? loadError.message : displayLabels.personalBestLoadFailed;
        }
        render();
    };
    const loadProfile = async (): Promise<void> => {
        const operation = request;
        if (authSnapshot.status !== 'signed-in' || !options.profilePort) { profile = null; render(); return; }
        try { profile = await options.profilePort.loadOrCreate(); }
        catch { profile = null; }
        if (destroyed || operation !== request || authSnapshot.status !== 'signed-in') return;
        render();
    };
    const open = (trigger: HTMLButtonElement, origin: 'game-menu' | 'game-over'): void => {
        if (destroyed) return;
        returnFocus = trigger; accountOrigin = origin;
        if (origin === 'game-menu') required<HTMLElement>(root, '#game-menu').hidden = true;
        dialog.hidden = false;
        clearData(); error = null; page = 0; render(); close.focus();
        void loadProfile();
        void load();
    };
    const closeDialog = (): void => {
        if (dialog.hidden) return;
        request++; loading = false; mutationPending = false; confirmationTrigger = null; confirmationRecord = null; mutationError = null; clearData(); error = null; dialog.hidden = true; render();
        if (accountOrigin === 'game-menu') required<HTMLElement>(root, '#game-menu').hidden = false;
        (returnFocus?.isConnected ? returnFocus : menuTrigger).focus();
    };
    const openMenu = (): void => open(menuTrigger, 'game-menu');
    const openGameOver = (): void => open(gameOverTrigger, 'game-over');
    const move = (delta: number): void => { const pageCount = Math.ceil(totalCount / resultHistoryPageSize); const target = page + delta; if (target < 0 || target >= pageCount) return; page = target; void load(); };
    const signInClick = (): void => options.openAccount(accountOrigin, signIn);
    const retryClick = (): void => { void load(); };
    const clearHistoryClick = (): void => openConfirmation(null, clearHistory);
    const confirmationNoClick = (): void => closeConfirmation(true);
    const confirmationYesClick = (): void => { void confirmMutation(); };
    const previousClick = (): void => move(-1);
    const nextClick = (): void => move(1);
    const authChange = (snapshot: Readonly<AuthSnapshot>): void => {
        const wasSignedIn = authSnapshot.status === 'signed-in';
        const identityChanged = wasSignedIn && snapshot.status === 'signed-in' && authSnapshot.email !== snapshot.email;
        authSnapshot = snapshot;
        if (wasSignedIn && snapshot.status !== 'signed-in') { request++; loading = false; mutationPending = false; clearData(); profile = null; error = null; if (!dialog.hidden) closeDialog(); }
        else if (identityChanged) { request++; loading = false; mutationPending = false; confirmationTrigger = null; confirmationRecord = null; mutationError = null; clearData(); profile = null; error = null; page = 0; render(); if (!dialog.hidden) { void loadProfile(); void load(); } }
        else if (mutationPending) { render(); return; }
        else if (!dialog.hidden && snapshot.status === 'signed-in') void load();
        render();
    };
    const keydown = (event: KeyboardEvent): void => {
        if (dialog.hidden) return;
        if (confirmationTrigger) {
            if (event.key === 'Escape') { event.preventDefault(); closeConfirmation(true); return; }
            if (event.key === 'Tab') {
                const controls = [confirmationNo, confirmationYes].filter(control => !control.disabled);
                const first = controls[0]; const last = controls[controls.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
            }
            return;
        }
        if (event.key === 'Escape') { event.preventDefault(); closeDialog(); return; }
        if (event.key !== 'Tab') return;
        const controls = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]):not([hidden])'));
        const first = controls[0]; const last = controls[controls.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    menuTrigger.textContent = displayLabels.personalBest; gameOverTrigger.textContent = displayLabels.personalBest;
    menuTrigger.addEventListener('click', openMenu); gameOverTrigger.addEventListener('click', openGameOver); close.addEventListener('click', closeDialog);
    previous.addEventListener('click', previousClick); next.addEventListener('click', nextClick); retry.addEventListener('click', retryClick); signIn.addEventListener('click', signInClick); clearHistory.addEventListener('click', clearHistoryClick); confirmationNo.addEventListener('click', confirmationNoClick); confirmationYes.addEventListener('click', confirmationYesClick); window.addEventListener('keydown', keydown);
    const unsubscribe = options.auth.subscribe(authChange);
    render();
    return { destroy: () => { if (destroyed) return; destroyed = true; request++; unsubscribe(); menuTrigger.removeEventListener('click', openMenu); gameOverTrigger.removeEventListener('click', openGameOver); close.removeEventListener('click', closeDialog); previous.removeEventListener('click', previousClick); next.removeEventListener('click', nextClick); retry.removeEventListener('click', retryClick); signIn.removeEventListener('click', signInClick); clearHistory.removeEventListener('click', clearHistoryClick); confirmationNo.removeEventListener('click', confirmationNoClick); confirmationYes.removeEventListener('click', confirmationYesClick); window.removeEventListener('keydown', keydown); } };
}
