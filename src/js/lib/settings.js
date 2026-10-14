// Pure: parsing and wording for the Settings page.
import { t } from './i18n.js';

// raw: the limit field's text. Whole numbers 0 to 100 only.
export function parseLimit(raw, lang = 'en') {
  const text = String(raw ?? '').trim();
  const error = t(lang, 'settings.limitInvalid');
  if (!/^\d+$/.test(text)) return { ok: false, error };
  const value = Number(text);
  if (value > 100) return { ok: false, error };
  return { ok: true, value };
}

const dollars = (n) => `$${n.toFixed(2)}`;

export function formatUsage(spent, cap, lang = 'en') {
  const used = spent > 0 && spent < 0.01 ? t(lang, 'settings.usageLessThan', { amount: '$0.01' }) : dollars(spent);
  return t(lang, 'settings.usageValue', { used, cap: dollars(cap) });
}
