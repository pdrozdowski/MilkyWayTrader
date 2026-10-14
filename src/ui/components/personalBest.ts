import { resultHistoryPageSize, type AuthPort, type AuthSnapshot, type PlayerProfilePort, type ResultHistoryRecord, type ResultHistoryStorePort, type UiHandle } from '../contracts';
import { displayLabels } from './displayLabels';
import { formatCredits } from './formatCredits';

interface PersonalBestOptions
{
    readonly store: ResultHistoryStorePort;
    readonly auth: AuthPort;
    readonly profilePort: PlayerProfilePort | null;
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
    const table = required<HTMLTableElement>(root, '#personal-best-table');
    const rows = required<HTMLTableSectionElement>(root, '#personal-best-rows');
    const headings = [required<HTMLElement>(root, '#personal-best-date-heading'), required<HTMLElement>(root, '#personal-best-score-heading'), required<HTMLElement>(root, '#personal-best-outcome-heading'), required<HTMLElement>(root, '#personal-best-best-heading'), required<HTMLElement>(root, '#personal-best-delete-heading')];
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
    let nickname: string | null = null;
    let totalCount = 0;
    let loading = false;
    let error: string | null = null;
    let returnFocus: HTMLElement | null = null;
    let accountOrigin: 'game-menu' | 'game-over' = 'game-menu';
    let request = 0;
    let profileRequest = 0;
    let destroyed = false;

    const clearData = (): void => { records = []; best = null; totalCount = 0; page = 0; };
    const render = (): void => {
        title.textContent = nickname ? `${displayLabels.personalBestTitlePrefix}${nickname}${displayLabels.personalBestTitleSuffix}` : displayLabels.personalBestTitle;
        highScore.textContent = best ? formatCredits(best.finalCredits) : '';
        highScore.hidden = !best;
        headings.forEach((heading, index) => { heading.textContent = [displayLabels.personalBestDate, displayLabels.personalBestScore, displayLabels.personalBestOutcome, displayLabels.personalBestBest, displayLabels.personalBestDelete][index]; });
        const signedIn = authSnapshot.status === 'signed-in';
        const populated = signedIn && !loading && !error && totalCount > 0;
        table.hidden = !populated;
        status.textContent = !signedIn ? displayLabels.personalBestSignInPrompt : loading ? displayLabels.personalBestLoading : error ? `${displayLabels.personalBestLoadFailed} ${error}` : totalCount === 0 ? displayLabels.personalBestNoScores : '';
        signIn.hidden = signedIn;
        signIn.textContent = displayLabels.accountGoogleSignIn;
        signIn.disabled = authSnapshot.status === 'unavailable';
        retry.hidden = !signedIn || !error;
        retry.textContent = displayLabels.personalBestRetry;
        const pageCount = Math.max(1, Math.ceil(totalCount / resultHistoryPageSize));
        indicator.textContent = `${page + 1} / ${pageCount}`;
        previous.textContent = displayLabels.personalBestPrevious;
        next.textContent = displayLabels.personalBestNext;
        previous.disabled = !populated || page <= 0 || loading;
        next.disabled = !populated || page >= pageCount - 1 || loading;
        close.textContent = displayLabels.personalBestClose;
        rows.replaceChildren();
        records.forEach(record => {
            const row = document.createElement('tr');
            const values = [dateLabel(record.savedAt), formatCredits(record.finalCredits), outcomeLabel(record), best?.runId === record.runId ? displayLabels.personalBestBest : ''];
            values.forEach(value => { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); });
            const deleteCell = document.createElement('td');
            const deleteButton = document.createElement('button');
            deleteButton.type = 'button'; deleteButton.textContent = displayLabels.personalBestDeletePlaceholder; deleteButton.disabled = true; deleteButton.tabIndex = -1;
            deleteCell.append(deleteButton); row.append(deleteCell); rows.append(row);
        });
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
    const loadNickname = async (): Promise<void> => {
        const operation = ++profileRequest;
        if (authSnapshot.status !== 'signed-in' || !options.profilePort) { nickname = null; render(); return; }
        try {
            const loaded = await options.profilePort.load();
            if (destroyed || operation !== profileRequest || authSnapshot.status !== 'signed-in') return;
            nickname = loaded?.nickname ?? null;
        } catch {
            if (destroyed || operation !== profileRequest) return;
            nickname = null;
        }
        render();
    };
    const open = (trigger: HTMLButtonElement, origin: 'game-menu' | 'game-over'): void => {
        if (destroyed) return;
        returnFocus = trigger; accountOrigin = origin;
        if (origin === 'game-menu') required<HTMLElement>(root, '#game-menu').hidden = true;
        dialog.hidden = false;
        clearData(); error = null; page = 0; render(); close.focus();
        void loadNickname();
        void load();
    };
    const closeDialog = (): void => {
        if (dialog.hidden) return;
        request++; profileRequest++; loading = false; nickname = null; clearData(); error = null; dialog.hidden = true; render();
        if (accountOrigin === 'game-menu') required<HTMLElement>(root, '#game-menu').hidden = false;
        (returnFocus?.isConnected ? returnFocus : menuTrigger).focus();
    };
    const openMenu = (): void => open(menuTrigger, 'game-menu');
    const openGameOver = (): void => open(gameOverTrigger, 'game-over');
    const move = (delta: number): void => { const pageCount = Math.ceil(totalCount / resultHistoryPageSize); const target = page + delta; if (target < 0 || target >= pageCount) return; page = target; void load(); };
    const signInClick = (): void => options.openAccount(accountOrigin, signIn);
    const retryClick = (): void => { void load(); };
    const previousClick = (): void => move(-1);
    const nextClick = (): void => move(1);
    const authChange = (snapshot: Readonly<AuthSnapshot>): void => {
        const wasSignedIn = authSnapshot.status === 'signed-in';
        const identityChanged = wasSignedIn && snapshot.status === 'signed-in' && authSnapshot.email !== snapshot.email;
        authSnapshot = snapshot;
        if (wasSignedIn && snapshot.status !== 'signed-in') { request++; profileRequest++; loading = false; nickname = null; clearData(); error = null; if (!dialog.hidden) closeDialog(); }
        else if (identityChanged) { request++; profileRequest++; loading = false; nickname = null; clearData(); error = null; page = 0; render(); if (!dialog.hidden) { void loadNickname(); void load(); } }
        else if (!dialog.hidden && snapshot.status === 'signed-in') { void loadNickname(); void load(); }
        render();
    };
    const keydown = (event: KeyboardEvent): void => {
        if (dialog.hidden) return;
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
    previous.addEventListener('click', previousClick); next.addEventListener('click', nextClick); retry.addEventListener('click', retryClick); signIn.addEventListener('click', signInClick); window.addEventListener('keydown', keydown);
    const unsubscribe = options.auth.subscribe(authChange);
    render();
    return { destroy: () => { if (destroyed) return; destroyed = true; request++; profileRequest++; unsubscribe(); menuTrigger.removeEventListener('click', openMenu); gameOverTrigger.removeEventListener('click', openGameOver); close.removeEventListener('click', closeDialog); previous.removeEventListener('click', previousClick); next.removeEventListener('click', nextClick); retry.removeEventListener('click', retryClick); signIn.removeEventListener('click', signInClick); window.removeEventListener('keydown', keydown); } };
}
