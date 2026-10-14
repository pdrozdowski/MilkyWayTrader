import type { AuthPort, AuthSnapshot, GlobalScoreRecord, GlobalScoreStorePort, PlayerProfilePort, ResultHistoryStorePort, UiHandle } from '../contracts';
import { displayLabels } from './displayLabels';
import { formatCredits } from './formatCredits';

interface GlobalHighScoresOptions
{
    readonly store: GlobalScoreStorePort;
    readonly history: ResultHistoryStorePort;
    readonly auth: AuthPort;
    readonly profilePort?: PlayerProfilePort | null;
}

function required<T extends Element> (root: HTMLElement, selector: string): T
{
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing Global High Scores control: ${selector}`);
    return element;
}

function dateLabel (value: string): string
{
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date).toUpperCase();
}

export function mountGlobalHighScores (root: HTMLElement, options: GlobalHighScoresOptions): UiHandle
{
    const dialog = required<HTMLElement>(root, '#global-high-scores');
    const title = required<HTMLElement>(root, '#global-high-scores-title');
    const nickname = required<HTMLElement>(root, '#global-high-scores-nickname');
    const rankCallout = required<HTMLElement>(root, '#global-high-scores-rank');
    const status = required<HTMLElement>(root, '#global-high-scores-status');
    const retry = required<HTMLButtonElement>(root, '#global-high-scores-retry');
    const table = required<HTMLTableElement>(root, '#global-high-scores-table');
    const rows = required<HTMLTableSectionElement>(root, '#global-high-scores-rows');
    const rankHeading = required<HTMLElement>(root, '#global-high-scores-rank-heading');
    const nicknameHeading = required<HTMLElement>(root, '#global-high-scores-nickname-heading');
    const dateHeading = required<HTMLElement>(root, '#global-high-scores-date-heading');
    const scoreHeading = required<HTMLElement>(root, '#global-high-scores-score-heading');
    const close = required<HTMLButtonElement>(root, '#global-high-scores-close');
    const mainMenuTrigger = required<HTMLButtonElement>(root, '#main-menu-global-scores');
    const gameMenuTrigger = required<HTMLButtonElement>(root, '#game-menu-global-scores');
    const gameOverTrigger = required<HTMLButtonElement>(root, '#game-over-global-scores');
    const mainMenu = required<HTMLElement>(root, '#main-menu');
    const gameMenu = required<HTMLElement>(root, '#game-menu');
    let authSnapshot: Readonly<AuthSnapshot> = options.auth.getSnapshot();
    let records: readonly GlobalScoreRecord[] = [];
    let profileNickname: string | null = null;
    let personalBestRank: number | null = null;
    let personalBestExists = false;
    let personalBestRankError = false;
    let loading = false;
    let error: string | null = null;
    let returnFocus: HTMLElement | null = null;
    let returnMenu: 'main' | 'game' | null = null;
    let request = 0;
    let destroyed = false;

    const clearPrivateData = (): void => { profileNickname = null; personalBestRank = null; personalBestExists = false; personalBestRankError = false; };
    const render = (): void => {
        title.textContent = displayLabels.globalHighScoresTitle;
        rankHeading.textContent = displayLabels.globalHighScoresRank;
        nicknameHeading.textContent = displayLabels.globalHighScoresNicknameHeading;
        dateHeading.textContent = displayLabels.globalHighScoresDate;
        scoreHeading.textContent = displayLabels.globalHighScoresScore;
        const signedIn = authSnapshot.status === 'signed-in';
        nickname.hidden = !signedIn || !profileNickname;
        nickname.textContent = profileNickname ? displayLabels.globalHighScoresNickname.replace('{nickname}', profileNickname) : '';
        rankCallout.hidden = !signedIn || (!personalBestExists && !personalBestRankError);
        rankCallout.textContent = personalBestRankError
            ? displayLabels.globalHighScoresRankUnavailable
            : personalBestRank
                ? displayLabels.globalHighScoresRankCallout.replace('{rank}', String(personalBestRank))
                : '';
        const populated = !loading && !error && records.length > 0;
        table.hidden = !populated;
        status.textContent = loading ? displayLabels.globalHighScoresLoading : error ? `${displayLabels.globalHighScoresLoadFailed} ${error}` : records.length === 0 ? displayLabels.globalHighScoresNoScores : '';
        retry.hidden = !error;
        retry.textContent = displayLabels.globalHighScoresRetry;
        close.textContent = displayLabels.globalHighScoresClose;
        rows.replaceChildren();
        records.forEach(record => {
            const row = document.createElement('tr');
            const values = [String(record.rank), record.nickname, dateLabel(record.achievedAt), formatCredits(record.score)];
            values.forEach(value => { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); });
            rows.append(row);
        });
    };
    const loadProfileAndRank = async (operation: number): Promise<void> => {
        clearPrivateData();
        if (authSnapshot.status !== 'signed-in') return;
        try {
            const [bestResult, profile] = await Promise.all([
                options.history.getBest(),
                options.profilePort?.loadOrCreate() ?? Promise.resolve(null)
            ]);
            if (destroyed || operation !== request || authSnapshot.status !== 'signed-in') return;
            profileNickname = profile?.nickname ?? null;
            if (bestResult.error) { personalBestRankError = true; return; }
            const best = bestResult.data;
            if (!best || best.finalScore === null) return;
            personalBestExists = true;
            const rankResult = await options.store.getPersonalBestRank(best.finalScore);
            if (destroyed || operation !== request || authSnapshot.status !== 'signed-in') return;
            if (rankResult.error) { personalBestRankError = true; }
            else personalBestRank = rankResult.data;
        } catch (loadError) {
            if (destroyed || operation !== request) return;
            personalBestRankError = true;
        }
    };
    const load = async (): Promise<void> => {
        const operation = ++request;
        loading = true; error = null; records = []; clearPrivateData(); render();
        try {
            const topPromise = options.store.getTop();
            const privatePromise = loadProfileAndRank(operation);
            const top = await topPromise;
            if (destroyed || operation !== request) return;
            if (top.error || !top.data) error = top.error ?? displayLabels.globalHighScoresLoadFailed;
            else records = top.data;
            loading = false;
            render();
            await privatePromise;
            if (destroyed || operation !== request) return;
            render();
        } catch (loadError) {
            if (destroyed || operation !== request) return;
            error = loadError instanceof Error ? loadError.message : displayLabels.globalHighScoresLoadFailed;
            loading = false;
            render();
        }
    };
    const open = (trigger: HTMLButtonElement, origin: 'main' | 'game' | null): void => {
        if (destroyed) return;
        returnFocus = trigger; returnMenu = origin;
        if (origin === 'main') mainMenu.hidden = true;
        if (origin === 'game') gameMenu.hidden = true;
        dialog.hidden = false;
        close.focus();
        void load();
    };
    const closeDialog = (): void => {
        if (dialog.hidden) return;
        request++; loading = false; error = null; records = []; clearPrivateData(); dialog.hidden = true;
        if (returnMenu === 'main') mainMenu.hidden = false;
        if (returnMenu === 'game') gameMenu.hidden = false;
        (returnFocus?.isConnected ? returnFocus : mainMenuTrigger).focus();
        returnFocus = null; returnMenu = null; render();
    };
    const openMainMenu = (): void => open(mainMenuTrigger, 'main');
    const openGameMenu = (): void => open(gameMenuTrigger, 'game');
    const openGameOver = (): void => open(gameOverTrigger, null);
    const retryLoad = (): void => { void load(); };
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

    mainMenuTrigger.setAttribute('aria-label', displayLabels.globalHighScores);
    gameMenuTrigger.textContent = displayLabels.globalHighScores;
    gameOverTrigger.textContent = displayLabels.globalHighScores;
    mainMenuTrigger.addEventListener('click', openMainMenu);
    gameMenuTrigger.addEventListener('click', openGameMenu);
    gameOverTrigger.addEventListener('click', openGameOver);
    retry.addEventListener('click', retryLoad);
    close.addEventListener('click', closeDialog);
    window.addEventListener('keydown', keydown);
    const unsubscribe = options.auth.subscribe(snapshot => {
        const wasSignedIn = authSnapshot.status === 'signed-in';
        const identityChanged = wasSignedIn && snapshot.status === 'signed-in' && authSnapshot.email !== snapshot.email;
        authSnapshot = snapshot;
        if (wasSignedIn && snapshot.status !== 'signed-in' || identityChanged) {
            request++; clearPrivateData(); error = null;
            if (wasSignedIn && snapshot.status !== 'signed-in' && !dialog.hidden) closeDialog();
            else if (!dialog.hidden) void load();
        } else if (!dialog.hidden && snapshot.status === 'signed-in') void load();
        render();
    });
    render();
    return { destroy: () => {
        if (destroyed) return;
        destroyed = true; request++; unsubscribe();
        mainMenuTrigger.removeEventListener('click', openMainMenu);
        gameMenuTrigger.removeEventListener('click', openGameMenu);
        gameOverTrigger.removeEventListener('click', openGameOver);
        retry.removeEventListener('click', retryLoad); close.removeEventListener('click', closeDialog);
        window.removeEventListener('keydown', keydown);
    } };
}
