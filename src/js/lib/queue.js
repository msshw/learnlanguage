// Pure: no DOM, no network, no clock. `now` is always passed in.
//
// cards:     card rows with their word embedded as `word` (all cards of the active pair's words)
// logsToday: [{ card_id, reviewed_at, state_before, cards: { direction } }] since the day start
// pending:   answers not saved yet: [{ card_id, reviewed_at, state_before, ... }]
// limit:     new words per day
import { dayStart, nextDayStart } from './time.js';

const ms = (iso) => new Date(iso).getTime();
const byDue = (a, b) => ms(a.due) - ms(b.due);
const isLearning = (c) => c.state === 'learning' || c.state === 'relearning';
const otherDirection = (d) => (d === 'de_en' ? 'en_de' : 'de_en');

function prepare({ cards, logsToday = [], pending = [], now, tz, limit }) {
  const start = dayStart(now, tz);
  const nextStart = nextDayStart(now, tz);
  const startMs = start.getTime();
  const nextStartMs = nextStart.getTime();

  const pendingIds = new Set(pending.map((p) => p.card_id));
  const byWordAndDirection = new Map(cards.map((c) => [`${c.word_id}:${c.direction}`, c]));
  const siblingOf = (c) => byWordAndDirection.get(`${c.word_id}:${otherDirection(c.direction)}`);
  const directionOf = new Map(cards.map((c) => [c.id, c.direction]));
  const live = cards.filter((c) => !c.word?.deleted_at && !pendingIds.has(c.id));

  // A word is introduced when its de_en card is reviewed for the first time (state_before was new).
  const introduced = new Set();
  const countIfIntroduction = (cardId, stateBefore, reviewedAt, direction) => {
    if (stateBefore?.state === 'new' && direction === 'de_en' && ms(reviewedAt) >= startMs) {
      introduced.add(cardId);
    }
  };
  for (const log of logsToday) {
    countIfIntroduction(log.card_id, log.state_before, log.reviewed_at, log.cards?.direction);
  }
  for (const p of pending) {
    countIfIntroduction(p.card_id, p.state_before, p.reviewed_at, directionOf.get(p.card_id));
  }
  const allowance = Math.max(0, limit - introduced.size);

  const due = live
    .filter((c) => (c.state === 'review' ? ms(c.due) < nextStartMs : isLearning(c) && ms(c.due) <= now.getTime()))
    .sort(byDue);

  // A new en_de card starts the day after its de_en card was reviewed.
  const newEnDe = live
    .filter((c) => {
      if (c.state !== 'new' || c.direction !== 'en_de' || ms(c.due) >= nextStartMs) return false;
      const sibling = siblingOf(c);
      return Boolean(sibling && sibling.state !== 'new' && sibling.last_review && ms(sibling.last_review) < startMs);
    })
    .sort(byDue);

  const newDeEn = live
    .filter((c) => c.state === 'new' && c.direction === 'de_en' && ms(c.due) < nextStartMs)
    .sort(byDue)
    .slice(0, allowance);

  // One card per word: the one earlier in queue order wins.
  const seen = new Set();
  const queue = [...due, ...newEnDe, ...newDeEn].filter((c) => {
    if (seen.has(c.word_id)) return false;
    seen.add(c.word_id);
    return true;
  });

  return { start, nextStart, live, queue, siblingOf, introducedCount: introduced.size };
}

export const buildQueue = (options) => prepare(options).queue;

// Earliest moment a card that is not in the queue will join it, or null.
export function nextAvailable(options) {
  const { now, tz } = options;
  const { nextStart, live, queue, siblingOf } = prepare(options);
  const inQueue = new Set(queue.map((c) => c.id));
  let best = null;
  const consider = (date) => {
    if (best === null || date < best) best = date;
  };

  for (const c of live) {
    if (inQueue.has(c.id)) continue;
    if (isLearning(c)) {
      consider(ms(c.due) > now.getTime() ? new Date(c.due) : now);
    } else if (c.state === 'review') {
      consider(ms(c.due) >= nextStart.getTime() ? dayStart(new Date(c.due), tz) : now);
    } else if (c.direction === 'de_en') {
      consider(nextStart); // waiting beyond today's limit
    } else if (siblingOf(c)?.state !== 'new') {
      consider(new Date(Math.max(nextStart.getTime(), dayStart(new Date(c.due), tz).getTime())));
    }
  }
  return best;
}

// kind: 'empty' (no words), 'due', 'nothing' (nothing due, no answers today), 'done' (answered today).
// newToday: words introduced today (first de_en answer), the number the daily limit counts.
export function homeStatus(options) {
  const { wordCount, now, tz, logsToday = [], pending = [] } = options;
  if (wordCount === 0) return { kind: 'empty', dueCount: 0, nextAvailable: null, newToday: 0 };

  const { queue, introducedCount: newToday } = prepare(options);
  const startMs = dayStart(now, tz).getTime();
  const answeredToday =
    logsToday.some((l) => ms(l.reviewed_at) >= startMs) || pending.some((p) => ms(p.reviewed_at) >= startMs);
  const next = nextAvailable(options);

  if (queue.length > 0) return { kind: 'due', dueCount: queue.length, nextAvailable: next, newToday };
  return { kind: answeredToday ? 'done' : 'nothing', dueCount: 0, nextAvailable: next, newToday };
}
