// Pure: no DOM, no network, no clock. Wraps ts-fsrs with default parameters (no fuzz).
import { fsrs } from 'ts-fsrs';

const STATES = ['new', 'learning', 'review', 'relearning'];
const f = fsrs();

// DB card fields -> ts-fsrs card
const toFsrsCard = (c) => ({
  due: new Date(c.due),
  stability: c.stability,
  difficulty: c.difficulty,
  elapsed_days: c.elapsed_days,
  scheduled_days: c.scheduled_days,
  learning_steps: c.learning_steps,
  reps: c.reps,
  lapses: c.lapses,
  state: STATES.indexOf(c.state),
  last_review: c.last_review ? new Date(c.last_review) : undefined,
});

// The FSRS fields of a card row, in the shape stored in review_logs.state_before.
export const fsrsFields = (c) => ({
  state: c.state,
  due: c.due,
  stability: c.stability,
  difficulty: c.difficulty,
  elapsed_days: c.elapsed_days,
  scheduled_days: c.scheduled_days,
  learning_steps: c.learning_steps,
  reps: c.reps,
  lapses: c.lapses,
  last_review: c.last_review ?? null,
});

// schedule(cardState, rating, now) -> nextState. Rating is 1 to 4 (Again, Hard, Good, Easy).
export function schedule(cardState, rating, now) {
  if (!STATES.includes(cardState.state)) throw new Error(`unknown card state: ${cardState.state}`);
  const { card } = f.next(toFsrsCard(cardState), now, rating);
  return {
    state: STATES[card.state],
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: Math.round(card.elapsed_days),
    scheduled_days: Math.round(card.scheduled_days),
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    last_review: card.last_review.toISOString(),
  };
}

// previewIntervals(cardState, now) -> [Again, Hard, Good, Easy] due dates. Changes nothing.
export const previewIntervals = (cardState, now) =>
  [1, 2, 3, 4].map((rating) => new Date(schedule(cardState, rating, now).due));
