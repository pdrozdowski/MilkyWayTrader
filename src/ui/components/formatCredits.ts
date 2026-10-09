/** Formats a credit amount for display as a whole number with grouped thousands. */
export function formatCredits (value: number): string
{
    return Math.round(value).toLocaleString('en-US');
}