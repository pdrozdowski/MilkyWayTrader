import type { AccountOrigin, AuthPort, AuthSnapshot, PlayerEligibilityPort, PlayerEligibilitySnapshot, PlayerProfile, PlayerProfilePort, UiHandle } from '../contracts';
import { displayLabels } from './displayLabels';

function required<T extends Element> (root: HTMLElement, selector: string): T
{
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing player account control: ${selector}`);
    return element;
}

export interface PlayerAccountOptions
{
    auth: AuthPort;
    profilePort: PlayerProfilePort | null;
    eligibility: PlayerEligibilityPort;
    generateDefaultNickname(): string;
    prepareSignIn(origin: 'main-menu' | 'game-over' | 'game-menu'): boolean;
    onOpenStateChange(open: boolean): void;
    clearSignInContext(): void;
}

export function mountPlayerAccount (root: HTMLElement, options: PlayerAccountOptions): UiHandle
{
    const modal = required<HTMLElement>(root, '#player-account');
    const title = required<HTMLElement>(root, '#player-account-title');
    const trigger = required<HTMLButtonElement>(root, '#main-menu-sign-in-preview');
    const triggerLabel = required<HTMLElement>(trigger, '.main-menu-sign-in-preview-label');
    const status = required<HTMLElement>(root, '#player-account-status');
    const email = required<HTMLElement>(root, '#player-account-email');
    const nickname = required<HTMLInputElement>(root, '#player-account-nickname');
    const updateReason = required<HTMLElement>(root, '#player-account-update-reason');
    const feedback = required<HTMLElement>(root, '#player-account-feedback');
    const benefitIntro = required<HTMLElement>(root, '#player-account-benefits-intro');
    const saveBenefit = required<HTMLElement>(root, '#player-account-save-benefit');
    const scoreBenefit = required<HTMLElement>(root, '#player-account-score-benefit');
    const signInLabel = required<HTMLElement>(root, '#player-account-sign-in-label');
    const accountTitle = required<HTMLElement>(root, '#player-account-status-title');
    const signedInStatus = required<HTMLElement>(root, '#player-account-signed-in-status');
    const emailLabel = required<HTMLElement>(root, '#player-account-email-label');
    const nicknameTitle = required<HTMLElement>(root, '#player-account-nickname-title');
    const nicknameHelp = required<HTMLElement>(root, '#player-account-nickname-help');
    const signIn = required<HTMLButtonElement>(root, '#player-account-sign-in');
    const signOut = required<HTMLButtonElement>(root, '#player-account-sign-out');
    const update = required<HTMLButtonElement>(root, '#player-account-update');
    const retry = required<HTMLButtonElement>(root, '#player-account-retry');
    const close = required<HTMLButtonElement>(root, '#player-account-close');
    const signOutLabel = required<HTMLButtonElement>(root, '#player-account-sign-out');
    const closeLabel = required<HTMLButtonElement>(root, '#player-account-close');
    const updateLabel = required<HTMLButtonElement>(root, '#player-account-update');
    const gameMenuTrigger = required<HTMLButtonElement>(root, '#game-menu-account');
    const gameMenuIdentity = required<HTMLElement>(root, '#game-menu-account-identity');
    const gameOverResults = required<HTMLElement>(root, '#game-over-results');
    let authSnapshot = options.auth.getSnapshot();
    let profileAccountEmail = authSnapshot.ownerId;
    let profile: Readonly<PlayerProfile> | null = null;
    let suggestedNickname: string | null = null;
    let profileLoading = false;
    let profileSaving = false;
    let profileOperation = 0;
    let authBusy = false;
    let origin: 'main-menu' | 'game-over' | 'game-menu' = 'main-menu';
    let returnFocus: HTMLElement | null = null;
    let destroyed = false;

    const setFeedback = (message: string): void => { feedback.textContent = message; };
    const render = (): void => {
        const signedIn = authSnapshot.status === 'signed-in';
        const unavailable = authSnapshot.status === 'unavailable';
        title.textContent = displayLabels.playerAccount;
        benefitIntro.textContent = displayLabels.accountBenefitsIntro;
        saveBenefit.textContent = displayLabels.accountBenefitSave;
        scoreBenefit.textContent = displayLabels.accountBenefitScores;
        signInLabel.textContent = displayLabels.accountGoogleSignIn;
        accountTitle.textContent = displayLabels.accountTitle;
        signedInStatus.textContent = displayLabels.accountSignedInStatus;
        emailLabel.textContent = displayLabels.accountEmail;
        nicknameTitle.textContent = displayLabels.accountNickname;
        nicknameHelp.textContent = displayLabels.accountNicknameHelp;
        signOutLabel.textContent = displayLabels.accountSignOut;
        closeLabel.textContent = displayLabels.closeAccount;
        updateLabel.textContent = displayLabels.updateNickname;
        status.textContent = authSnapshot.status === 'error' ? authSnapshot.message ?? displayLabels.authError : '';
        email.textContent = authSnapshot.email ?? '';
        email.closest<HTMLElement>('[data-player-account-signed-in]')!.hidden = !signedIn;
        root.querySelector<HTMLElement>('[data-player-account-signed-out]')!.hidden = signedIn;
        signIn.disabled = unavailable || authBusy;
        signOut.hidden = !signedIn;
        signOut.disabled = authBusy;
        nickname.disabled = !signedIn || profileLoading || profileSaving || !profile;
        if (profile && document.activeElement !== nickname) nickname.value = profile.nickname;
        else if (signedIn && suggestedNickname && document.activeElement !== nickname) nickname.value = suggestedNickname;
        const validNickname = /^[A-Za-z0-9_]{3,20}$/.test(nickname.value.trim());
        const nicknameUnchanged = Boolean(profile && nickname.value.trim() === profile.nickname);
        update.disabled = !signedIn || !profile || profileLoading || profileSaving || authBusy || nicknameUnchanged || !validNickname;
        const updateReasonIsError = signedIn && Boolean(profile) && !profileLoading && !profileSaving && !validNickname;
        updateReason.textContent = !signedIn || !profile ? '' : profileLoading ? displayLabels.nicknameUpdateLoading : profileSaving ? displayLabels.nicknameUpdateSaving : !validNickname ? displayLabels.nicknameUpdateInvalid : nicknameUnchanged ? displayLabels.nicknameUpdateUnchanged : '';
        updateReason.classList.toggle('is-error', updateReasonIsError);
        retry.hidden = !signedIn || profileLoading || !feedback.textContent?.startsWith(displayLabels.profileLoadFailed);
        trigger.disabled = unavailable;
        triggerLabel.textContent = signedIn ? authSnapshot.email ?? displayLabels.accountSignedInWithoutEmail : displayLabels.signIn;
        gameMenuIdentity.textContent = signedIn ? authSnapshot.email ?? displayLabels.accountSignedInWithoutEmail : displayLabels.accountAnonymous;
    };
    const onEligibilityChange = (eligibility: Readonly<PlayerEligibilitySnapshot>): void => {
        if (eligibility.ownerId !== authSnapshot.ownerId) return;
        profileLoading = eligibility.status === 'loading';
        profile = eligibility.status === 'ready' ? eligibility.profile : null;
        if (eligibility.status === 'failed') setFeedback(`${displayLabels.profileLoadFailed} ${eligibility.message ?? ''}`.trim());
        else if (eligibility.status === 'ready') setFeedback('');
        render();
    };
    const openFrom = (nextOrigin: typeof origin, control: HTMLElement): void => {
        if (destroyed) return;
        origin = nextOrigin;
        if (origin === 'main-menu') {
            const returnStatus = root.querySelector<HTMLElement>('#main-menu-return-status');
            if (returnStatus) { returnStatus.textContent = ''; returnStatus.hidden = true; }
        }
        returnFocus = control;
        modal.hidden = false;
        options.onOpenStateChange(true);
        if (origin === 'game-menu') document.querySelector<HTMLElement>('#game-menu')!.hidden = true;
        setFeedback('');
        render();
        close.focus();
    };
    const closeModal = (): void => {
        if (modal.hidden) return;
        modal.hidden = true;
        options.onOpenStateChange(false);
        if (origin === 'game-menu') document.querySelector<HTMLElement>('#game-menu')!.hidden = false;
        const personalBest = root.querySelector<HTMLElement>('#personal-best');
        const personalBestClose = root.querySelector<HTMLButtonElement>('#personal-best-close');
        if (returnFocus && returnFocus.isConnected && !returnFocus.closest('[hidden]') && !(returnFocus instanceof HTMLButtonElement && returnFocus.disabled)) returnFocus.focus();
        else if (personalBest && !personalBest.hidden && personalBestClose) personalBestClose.focus();
        else trigger.focus();
    };
    const openMainMenu = (): void => openFrom(gameOverResults.hidden ? 'main-menu' : 'game-over', trigger);
    const openGameMenu = (): void => openFrom('game-menu', gameMenuTrigger);
    const openOnReturn = (event: Event): void => {
        const detail = (event as CustomEvent<AccountOrigin | { origin: AccountOrigin; returnFocus?: HTMLElement }>).detail;
        const requestedOrigin = typeof detail === 'string' ? detail : detail.origin;
        const requestedFocus = typeof detail === 'string' ? null : detail.returnFocus ?? null;
        openFrom(requestedOrigin, requestedFocus ?? (requestedOrigin === 'game-menu' ? gameMenuTrigger : trigger));
    };
    const onAuthChange = (snapshot: Readonly<AuthSnapshot>): void => {
        const prior = authSnapshot.status;
        const accountChanged = snapshot.status === 'signed-in' && (prior !== 'signed-in' || snapshot.ownerId !== profileAccountEmail);
        authSnapshot = snapshot;
        if (snapshot.status === 'error') options.clearSignInContext();
        if (snapshot.status !== 'signed-in' || accountChanged) {
            profileOperation++;
            profileLoading = false;
            profileSaving = false;
            profile = null;
            suggestedNickname = snapshot.status === 'signed-in' ? options.generateDefaultNickname() : null;
        }
        profileAccountEmail = snapshot.status === 'signed-in' ? snapshot.ownerId : null;
        render();
        if (accountChanged && !modal.hidden) setFeedback('');
    };
    const signInClick = async (): Promise<void> => {
        if (authBusy || signIn.disabled) return;
        authBusy = true;
        render();
        if (!options.prepareSignIn(origin)) { options.clearSignInContext(); authBusy = false; setFeedback('Unable to preserve this run for sign-in. Please try again.'); render(); return; }
        try { await options.auth.signInWithGoogle(); }
        catch (error) { options.clearSignInContext(); setFeedback(error instanceof Error ? error.message : displayLabels.authError); }
        finally { authBusy = false; render(); }
    };
    const signOutClick = async (): Promise<void> => {
        if (authBusy) return;
        authBusy = true;
        render();
        try { await options.auth.signOut(); profile = null; }
        catch (error) { setFeedback(error instanceof Error ? error.message : displayLabels.authError); }
        finally { authBusy = false; render(); }
    };
    const updateClick = async (): Promise<void> => {
        if (!options.profilePort || !profile || update.disabled || profileSaving) return;
        const operation = profileOperation;
        const ownerId = profileAccountEmail;
        const requestedNickname = nickname.value;
        profileSaving = true;
        render();
        try {
            const updated = await options.profilePort.updateNickname(requestedNickname);
            if (operation !== profileOperation || authSnapshot.status !== 'signed-in' || authSnapshot.ownerId !== ownerId) return;
            profile = updated;
            nickname.value = profile.nickname;
            setFeedback(displayLabels.nicknameUpdated);
        } catch (error) {
            if (operation === profileOperation) setFeedback(error instanceof Error ? error.message : displayLabels.nicknameUpdateFailed);
        } finally {
            if (operation === profileOperation) { profileSaving = false; render(); }
        }
    };
    const retryClick = (): void => { options.eligibility.retry(); };
    const signInHandler = (): void => { void signInClick(); };
    const signOutHandler = (): void => { void signOutClick(); };
    const updateHandler = (): void => { void updateClick(); };
    const keydown = (event: KeyboardEvent): void => {
        if (modal.hidden) return;
        if (event.key === 'Escape') { event.preventDefault(); closeModal(); return; }
        if (event.key !== 'Tab') return;
        const controls = Array.from(modal.querySelectorAll<HTMLElement>('button:not([disabled]):not([hidden]), input:not([disabled]):not([hidden])'));
        const first = controls[0]; const last = controls[controls.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    trigger.addEventListener('click', openMainMenu);
    gameMenuTrigger.addEventListener('click', openGameMenu);
    signIn.addEventListener('click', signInHandler);
    signOut.addEventListener('click', signOutHandler);
    update.addEventListener('click', updateHandler);
    retry.addEventListener('click', retryClick);
    nickname.addEventListener('input', render);
    close.addEventListener('click', closeModal);
    window.addEventListener('keydown', keydown);
    root.addEventListener('player-account-open', openOnReturn);
    const unsubscribe = options.auth.subscribe(onAuthChange);
    const unsubscribeEligibility = options.eligibility.subscribe(onEligibilityChange);
    render();
    onEligibilityChange(options.eligibility.getSnapshot());
    return { destroy: () => {
        if (destroyed) return;
        destroyed = true;
        unsubscribe(); unsubscribeEligibility(); trigger.removeEventListener('click', openMainMenu); gameMenuTrigger.removeEventListener('click', openGameMenu);
        signIn.removeEventListener('click', signInHandler); signOut.removeEventListener('click', signOutHandler); update.removeEventListener('click', updateHandler);
        retry.removeEventListener('click', retryClick); nickname.removeEventListener('input', render); close.removeEventListener('click', closeModal); window.removeEventListener('keydown', keydown);
        root.removeEventListener('player-account-open', openOnReturn);
    } };
}
