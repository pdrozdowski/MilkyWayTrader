export interface MainMenuBackgroundTransform
{
    readonly x: number;
    readonly y: number;
    readonly scale: number;
}

/** Fits the artwork vertically, preserving its aspect ratio and centering any horizontal crop or letterbox. */
export function mainMenuBackgroundTransform (
    viewport: Readonly<{ width: number; height: number }>, imageHeight: number
): MainMenuBackgroundTransform
{
    return { x: viewport.width / 2, y: viewport.height / 2, scale: viewport.height / imageHeight };
}
