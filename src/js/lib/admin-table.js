import { showForbidden } from './admin-guard.js';
import { invokeAdmin } from './db.js';

export const ymd = (iso) => new Date(iso).toLocaleDateString();
export const usd = (n) => `$${n.toFixed(4)}`;

// Read-only paged table, 50 rows at a time (the server decides). Columns are [header, cell text getter].
// The markup is components/admin-table.html. Returns { load }; load() answers 'forbidden' for a non-admin.
export function mountTable({ action, emptyText, columns }) {
  const root = document.querySelector('#table');
  const [error, emptyBox, body] = ['.table-error', '.table-empty', '.table-body'].map((q) => root.querySelector(q));
  const [prev, next] = ['.table-prev', '.table-next'].map((q) => root.querySelector(q));
  root.querySelector('.table-empty-text').textContent = emptyText;
  root.querySelector('.table-head').replaceChildren(
    ...columns.map(([header]) => {
      const th = document.createElement('th');
      th.scope = 'col';
      th.className = 'v-hint pr-4 pb-2';
      th.textContent = header;
      return th;
    }),
  );
  let offset = 0;

  async function load(to = offset) {
    error.hidden = true;
    try {
      const result = await invokeAdmin({ action, offset: to });
      if (result.status === 'forbidden') return 'forbidden';
      if (result.status !== 'ok' || !Array.isArray(result.rows)) throw new Error('bad answer');
      offset = to;
      root.querySelector('.table-rows').replaceChildren(
        ...result.rows.map((row) => {
          const tr = document.createElement('tr');
          tr.append(
            ...columns.map(([, cell]) => {
              const td = document.createElement('td');
              td.className = 'pr-4 py-1';
              td.textContent = cell(row);
              return td;
            }),
          );
          return tr;
        }),
      );
      emptyBox.hidden = result.rows.length > 0 || offset > 0;
      body.hidden = result.rows.length === 0 && offset === 0;
      prev.disabled = offset === 0;
      next.disabled = result.has_more !== true;
    } catch {
      error.hidden = false;
    }
  }
  const go = async (to) => {
    if ((await load(to)) === 'forbidden') showForbidden();
  };
  prev.addEventListener('click', () => go(Math.max(0, offset - 50)));
  next.addEventListener('click', () => go(offset + 50));
  root.querySelector('.table-retry').addEventListener('click', () => go(offset));
  return { load: () => load() };
}
