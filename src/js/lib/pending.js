// Answers that could not be saved yet. Entries are { payload, attempts }, oldest first.
// Storage and the send function are passed in so this can be tested without a browser.
const BANNER_AFTER_ATTEMPTS = 3;

const entryId = (e) => `${e.payload.card_id}|${e.payload.reviewed_at}`;

// storage: anything with getItem/setItem (localStorage). If it throws, entries live in memory.
export function createPendingList(key, storage) {
  let memory = null;
  let flushing = null;

  const read = () => {
    if (memory) return memory;
    try {
      return JSON.parse(storage.getItem(key) ?? '[]');
    } catch {
      memory = [];
      return memory;
    }
  };
  const write = (entries) => {
    if (memory) {
      memory = entries;
      return;
    }
    try {
      storage.setItem(key, JSON.stringify(entries));
    } catch {
      memory = entries;
    }
  };

  const add = (payload) => {
    const entries = read();
    const entry = { payload, attempts: 1 };
    if (!entries.some((e) => entryId(e) === entryId(entry))) write([...entries, entry]);
  };

  // Sends entries oldest first. Stops at the first failure so order is kept.
  const runFlush = async (send) => {
    for (;;) {
      const first = read()[0];
      if (!first) return;
      try {
        await send(first.payload);
        write(read().filter((e) => entryId(e) !== entryId(first)));
      } catch {
        write(read().map((e) => (entryId(e) === entryId(first) ? { ...e, attempts: e.attempts + 1 } : e)));
        return;
      }
    }
  };

  return {
    payloads: () => read().map((e) => e.payload),
    needsBanner: () => read().some((e) => e.attempts >= BANNER_AFTER_ATTEMPTS),
    add,

    flush(send) {
      flushing ??= runFlush(send).finally(() => {
        flushing = null;
      });
      return flushing;
    },

    // Retries older answers first so order is kept. If any are still stuck, the new answer
    // joins the list without a send attempt; otherwise it is sent, and kept only if that fails.
    async record(payload, send) {
      await this.flush(send);
      if (read().length === 0) {
        try {
          await send(payload);
          return;
        } catch {
          // fall through to the list
        }
      }
      add(payload);
    },
  };
}

export function userPending(userId) {
  let storage = null;
  try {
    storage = localStorage;
  } catch {
    // storage blocked: the list falls back to memory
  }
  return createPendingList(`pendingReviews:${userId}`, storage);
}
