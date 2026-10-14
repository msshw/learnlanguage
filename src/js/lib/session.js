// Pure: no DOM, no network, no clock.
import { t } from './i18n.js';

const REASON = { article_wrong: 'articleWrong', wrong: 'wrong', typo: 'typo' };

// Summary of one Review session, from its answers ({ cardId, word, rating, result }) in order.
// Counted per card: a card is "to watch" if any answer was Again or Hard, else "remembered".
// An Again card answered again later still counts once. The reason comes from the first such answer.
export function sessionSummary(answers, lang = 'en') {
  const cards = new Set();
  const watch = new Map();
  for (const a of answers) {
    cards.add(a.cardId);
    if (a.rating <= 2 && !watch.has(a.cardId)) {
      const reason = t(lang, `session.reason.${REASON[a.result] ?? (a.rating === 1 ? 'again' : 'hard')}`);
      watch.set(a.cardId, { word: a.word, reason });
    }
  }
  return { reviewed: cards.size, remembered: cards.size - watch.size, toWatch: [...watch.values()] };
}
