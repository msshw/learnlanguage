// Pure: pass `now` in.
import { MONTHLY_CAP_USD, PRICE_INPUT, PRICE_OUTPUT } from './config.ts';

// First instant of the calendar month in UTC.
export const monthStart = (now: Date): Date => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

export const costUsd = (inputTokens: number, outputTokens: number): number =>
  inputTokens * PRICE_INPUT + outputTokens * PRICE_OUTPUT;

// The epsilon (a thousandth of a cent's thousandth) absorbs float error so exactly $2.00 of tokens
// counts as the cap, while one token short of it does not.
export const isOverCap = (usd: number): boolean => usd >= MONTHLY_CAP_USD - 1e-9;

// What the usage request returns. Rounded so float noise does not reach the client.
export const usageSummary = (inputTokens: number, outputTokens: number) => ({
  spent_usd: Number(costUsd(inputTokens, outputTokens).toFixed(6)),
  cap_usd: MONTHLY_CAP_USD,
});
