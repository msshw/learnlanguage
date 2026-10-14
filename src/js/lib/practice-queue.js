// Pure: no DOM, no network, no clock. `now` is always passed in.
//
// cards:     practice card rows with `word` (the word row) and `forwardState` (state of the word's forward review card)
// logsToday: [{ sentence_card_id, practiced_at, state_before }] since the day start
//
// A practice card is due like a review card: a review-state card until the next 04:00 rollover,
// a learning card once its time has come. New cards join once the word's forward card is in review
// state, oldest word first, up to PRACTICE_NEW_PER_DAY introduced per logical day.
import { dayStart, nextDayStart } from './time.js';

export const PRACTICE_NEW_PER_DAY = 5;

const ms = (iso) => new Date(iso).getTime();
const isLearning = (c) => c.state === 'learning' || c.state === 'relearning';

function prepare({ cards, logsToday = [], now, tz, limit = PRACTICE_NEW_PER_DAY }) {
  const start = dayStart(now, tz);
  const nextStart = nextDayStart(now, tz);
  const live = cards.filter((c) => !c.word?.deleted_at);

  // A practice card is introduced when its first attempt is logged (state_before was new).
  const introduced = new Set(
    logsToday
      .filter((l) => l.state_before?.state === 'new' && ms(l.practiced_at) >= start.getTime())
      .map((l) => l.sentence_card_id),
  );
  const allowance = Math.max(0, limit - introduced.size);

  const due = live
    .filter((c) => (c.state === 'review' ? ms(c.due) < nextStart.getTime() : isLearning(c) && ms(c.due) <= now.getTime()))
    .sort((a, b) => ms(a.due) - ms(b.due));

  const eligibleNew = live
    .filter((c) => c.state === 'new' && c.forwardState === 'review')
    .sort((a, b) => ms(a.word?.created_at) - ms(b.word?.created_at));

  // Each card and each word appears once.
  const seenCards = new Set();
  const seenWords = new Set();
  const queue = [...due, ...eligibleNew.slice(0, allowance)].filter((c) => {
    if (seenCards.has(c.id) || seenWords.has(c.word_id)) return false;
    seenCards.add(c.id);
    seenWords.add(c.word_id);
    return true;
  });

  return { nextStart, live, queue, introducedCount: introduced.size };
}

export const practiceQueue = (options) => prepare(options).queue;

// { dueCount, nextAvailable }: the queue length, and the earliest moment a card that is not in it
// will join it (or null). A new card whose forward card is not in review state has no known time.
export function practiceStatus(options) {
  const { now, tz } = options;
  const { nextStart, live, queue } = prepare(options);
  const inQueue = new Set(queue.map((c) => c.id));
  let best = null;
  const consider = (date) => {
    if (best === null || date < best) best = date;
  };
  for (const c of live) {
    if (inQueue.has(c.id)) continue;
    if (isLearning(c)) consider(ms(c.due) > now.getTime() ? new Date(c.due) : now);
    else if (c.state === 'review') consider(ms(c.due) >= nextStart.getTime() ? dayStart(new Date(c.due), tz) : now);
    else if (c.state === 'new' && c.forwardState === 'review') consider(nextStart); // beyond today's limit
  }
  return { dueCount: queue.length, nextAvailable: best };
}
