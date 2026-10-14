// Pure: maps stored senses to what the client gets. Each served sense carries its stored position
// (`index`, what confirm sends back) and its `state`. Rejected senses are never served.
type Stored = { state?: string; [key: string]: unknown };

export const servedSenses = (senses: Stored[]) =>
  senses
    .map((s, index) => ({ ...s, index, state: s.state ?? 'candidate' }))
    .filter((s) => s.state !== 'rejected');

// A fresh model result: all candidates, stored with `state` (judged is never set here).
export const asCandidates = <T extends object>(senses: T[]) => senses.map((s) => ({ ...s, state: 'candidate' }));
