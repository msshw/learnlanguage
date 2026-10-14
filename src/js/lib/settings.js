// Pure: parsing and wording for the Settings page.

// raw: the limit field's text. Whole numbers 0 to 100 only.
export function parseLimit(raw) {
  const text = String(raw ?? '').trim();
  if (!/^\d+$/.test(text)) return { ok: false, error: 'Enter a whole number from 0 to 100' };
  const value = Number(text);
  if (value > 100) return { ok: false, error: 'Enter a whole number from 0 to 100' };
  return { ok: true, value };
}

const dollars = (n) => `$${n.toFixed(2)}`;

export function formatUsage(spent, cap) {
  const used = spent > 0 && spent < 0.01 ? 'less than $0.01' : dollars(spent);
  return `${used} of ${dollars(cap)}`;
}
