import type { GameIntroPort, UiHandle } from '../contracts';
import { displayLabels } from './displayLabels';

const storyArtwork = [
    '/assets/story_art1.png',
    '/assets/story_art2.png',
    '/assets/story_art3.png',
    '/assets/story_art4_desktop.png'
] as const;

const mobileFinalStoryArtwork = '/assets/story_art4_mobile.png.png';

const storyDescriptions = [
    'You were once a proud member of the Milky Way Traders Guild. You had ships, cargo, credits, and the galaxy was yours.',
    'An expedition went terribly wrong. Ships were lost, cargo vanished, and insurance found a reason not to pay.',
    'The Guild still wants its taxes. You have one ship, a handful of credits, a massive tax bill, and a real deadline of 30 days.',
    'It is time to get back to work: fly, clear the way, trade, and earn credits. Steer your ship, fire to clear hazards, land to trade/refuel/upgrade, and boost to go faster.'
] as const;

function required<T extends Element> (root: HTMLElement, selector: string): T
{
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing game introduction control: ${selector}`);
    return element;
}

export function mountGameIntro (root: HTMLElement, port: GameIntroPort): UiHandle
{
    const dialog = required<HTMLElement>(root, '#game-intro');
    const title = required<HTMLElement>(root, '#game-intro-title');
    const story = required<HTMLElement>(root, '#game-intro-story');
    const storyDescription = required<HTMLElement>(root, '#game-intro-story-description');
    const art = required<HTMLImageElement>(root, '#game-intro-art');
    const storyAdvance = required<HTMLButtonElement>(root, '#game-intro-story-advance');
    const previous = required<HTMLButtonElement>(root, '#game-intro-previous');
    const next = required<HTMLButtonElement>(root, '#game-intro-next');
    const debt = required<HTMLElement>(root, '#game-intro-debt');
    const debtTitle = required<HTMLElement>(root, '#game-intro-debt-title');
    const debtAmount = required<HTMLElement>(root, '#game-intro-debt-amount');
    const debtGoal = required<HTMLElement>(root, '#game-intro-debt-goal');
    const start = required<HTMLButtonElement>(root, '#game-intro-start');
    const mainMenu = required<HTMLElement>(root, '#main-menu');
    const appContents = Array.from(root.querySelectorAll<HTMLElement>('[data-app-content]'));
    if (appContents.length === 0) throw new Error('Missing application content for the game introduction modal.');
    let slideIndex = 0;
    let focusReturn: HTMLElement | null = null;
    let completed = false;
    let appInertBeforeOpen: boolean[] = [];
    let openTimer: number | null = null;
    let preparing = false;
    let destroyed = false;

    const render = (): void => {
        title.textContent = displayLabels.gameIntroTitle;
        art.src = slideIndex === storyArtwork.length - 1 && window.matchMedia?.('(pointer: coarse)').matches
            ? mobileFinalStoryArtwork
            : storyArtwork[slideIndex];
        art.alt = '';
        storyDescription.textContent = storyDescriptions[slideIndex];
        next.textContent = displayLabels.gameIntroNext;
        previous.setAttribute('aria-label', displayLabels.gameIntroPrevious);
        storyAdvance.setAttribute('aria-label', displayLabels.gameIntroAdvance);
        story.hidden = slideIndex >= storyArtwork.length;
        previous.hidden = story.hidden || slideIndex === 0;
        next.hidden = story.hidden;
        debt.hidden = !story.hidden;
        if (!debt.hidden) {
            debtTitle.textContent = displayLabels.gameIntroDebtTitle;
            debtAmount.textContent = displayLabels.gameIntroDebtAmount;
            debtGoal.textContent = displayLabels.gameIntroDebtGoal;
            start.textContent = displayLabels.gameIntroStart;
        }
    };
    const advance = (event?: Event): void => {
        event?.stopPropagation();
        if (completed || slideIndex >= storyArtwork.length) return;
        slideIndex += 1;
        render();
        if (slideIndex >= storyArtwork.length) start.focus();
        else next.focus();
    };
    const goBack = (event: Event): void => {
        event.stopPropagation();
        if (completed || slideIndex <= 0 || slideIndex >= storyArtwork.length) return;
        slideIndex -= 1;
        render();
        next.focus();
    };
    const begin = (event: Event): void => {
        event.stopPropagation();
        if (completed) return;
        completed = true;
        dialog.hidden = true;
        mainMenu.inert = false;
        appContents.forEach((content, index) => { content.inert = appInertBeforeOpen[index] ?? false; });
        port.startGame();
    };
    const overlayClick = (event: MouseEvent): void => {
        if (event.target === dialog) return;
        advance();
    };
    const stopBubble = (event: Event): void => { event.stopPropagation(); };
    const keydown = (event: KeyboardEvent): void => {
        if (dialog.hidden) return;
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); return; }
        if (event.key === 'Tab') {
            const controls = [storyAdvance, previous, next, start].filter(control => !control.hidden && !control.closest('[hidden]'));
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (!first || !last) return;
            if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
        }
    };
    const open = (): void => {
        completed = false;
        slideIndex = 0;
        focusReturn = document.activeElement && 'focus' in document.activeElement ? document.activeElement as HTMLElement : null;
        mainMenu.inert = true;
        appInertBeforeOpen = appContents.map(content => content.inert);
        appContents.forEach(content => { content.inert = true; });
        dialog.hidden = false;
        render();
        next.focus();
    };
    const close = (): void => {
        dialog.hidden = true;
        mainMenu.inert = false;
        appContents.forEach((content, index) => { content.inert = appInertBeforeOpen[index] ?? false; });
        focusReturn?.focus();
        focusReturn = null;
    };
    const newGame = (): void => {
        if (destroyed || preparing || openTimer !== null || !dialog.hidden) return;
        const scheduleOpen = (): void => { openTimer = window.setTimeout(() => {
            openTimer = null;
            open();
        }, 0); };
        if (!port.prepareNewGame) { scheduleOpen(); return; }
        preparing = true;
        void port.prepareNewGame().then(allowed => { if (allowed && !destroyed) scheduleOpen(); }).catch(() => undefined).finally(() => { preparing = false; });
    };

    story.addEventListener('click', overlayClick);
    storyAdvance.addEventListener('click', advance);
    previous.addEventListener('click', goBack);
    next.addEventListener('click', advance);
    start.addEventListener('click', begin);
    dialog.addEventListener('click', stopBubble);
    window.addEventListener('keydown', keydown, true);
    root.querySelector('#main-menu-new-game')?.addEventListener('click', newGame);
    return {
        destroy: () => {
            destroyed = true;
            if (openTimer !== null) window.clearTimeout(openTimer);
            openTimer = null;
            story.removeEventListener('click', overlayClick);
            storyAdvance.removeEventListener('click', advance);
            previous.removeEventListener('click', goBack);
            next.removeEventListener('click', advance);
            start.removeEventListener('click', begin);
            dialog.removeEventListener('click', stopBubble);
            window.removeEventListener('keydown', keydown, true);
            root.querySelector('#main-menu-new-game')?.removeEventListener('click', newGame);
            close();
        }
    };
}
