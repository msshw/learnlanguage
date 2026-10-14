// Pure: turns open report rows (each with its joined suggestion) into one entry per suggestion,
// oldest first report first. Reasons are collected oldest first.
export type ReportRow = {
  suggestion_id: string;
  created_at: string;
  reason: string | null;
  ai_suggestions: {
    target_lang: string;
    native_lang: string;
    corrected_key: string;
    senses: unknown[];
    status: string;
  } | null;
};

export function groupReports(rows: ReportRow[]) {
  const byId = new Map<string, any>();
  for (const row of [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const s = row.ai_suggestions;
    if (!s) continue;
    const reason = row.reason ?? null;
    const entry = byId.get(row.suggestion_id);
    if (!entry) {
      byId.set(row.suggestion_id, {
        suggestion_id: row.suggestion_id,
        term: (s.senses[0] as any)?.term ?? s.corrected_key,
        target_lang: s.target_lang,
        native_lang: s.native_lang,
        status: s.status,
        senses: s.senses,
        report_count: 1,
        first_reported_at: row.created_at,
        reasons: reason ? [reason] : [],
      });
    } else {
      entry.report_count += 1;
      if (reason) entry.reasons.push(reason);
    }
  }
  return [...byId.values()].sort((a, b) => a.first_reported_at.localeCompare(b.first_reported_at));
}

// Pure: turns rejected_senses rows into one entry per rejection. One moderation step writes a
// sense under up to two keys (entered and corrected term) in one statement, so those rows share
// created_at; an entry is pair + fingerprint + created_at. Newest first.
export type RejectedRow = {
  id: number;
  target_lang: string;
  native_lang: string;
  term_key: string;
  fingerprint: string;
  part_of_speech: string;
  translations: string[];
  created_at: string;
};

export function groupRejected(rows: RejectedRow[]) {
  const byGroup = new Map<string, any>();
  for (const r of rows) {
    const k = [r.target_lang, r.native_lang, r.fingerprint, r.created_at].join('\u0000');
    const entry = byGroup.get(k);
    if (entry) {
      entry.ids.push(r.id);
      if (!entry.keys.includes(r.term_key)) entry.keys.push(r.term_key);
    } else {
      byGroup.set(k, {
        ids: [r.id],
        keys: [r.term_key],
        target_lang: r.target_lang,
        native_lang: r.native_lang,
        part_of_speech: r.part_of_speech,
        translations: r.translations,
        rejected_at: r.created_at,
      });
    }
  }
  return [...byGroup.values()]
    .map((e) => ({ ...e, keys: e.keys.sort(), ids: e.ids.sort((a: number, b: number) => a - b) }))
    .map((e) => ({ ...e, term: e.keys.join(' / ') }))
    .sort((a, b) => b.rejected_at.localeCompare(a.rejected_at) || b.ids[0] - a.ids[0]);
}

// Pure: for allow_again. Of the suggestions found for the entry's keys, keeps those with a
// rejected sense of the entry's fingerprint and pairs each with its senses' fingerprints.
export function recordsToRestore(
  records: { id: string; senses: any[] }[],
  fp: string,
  fingerprintOf: (s: any) => string,
) {
  return records
    .map((r) => ({ id: r.id, fingerprints: r.senses.map(fingerprintOf), senses: r.senses }))
    .filter((r) => r.senses.some((s, i) => s?.state === 'rejected' && r.fingerprints[i] === fp))
    .map(({ id, fingerprints }) => ({ id, fingerprints }));
}
