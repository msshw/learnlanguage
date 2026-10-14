import { startAdminPage } from '../lib/admin-guard.js';
import { mountTable, ymd } from '../lib/admin-table.js';

const table = mountTable({
  action: 'list_suggestions',
  emptyText: 'No suggestions',
  columns: [
    ['Term', (r) => r.term],
    ['Pair', (r) => `${r.target_lang} to ${r.native_lang}`],
    ['Status', (r) => (r.status === 'removed' ? 'Removed' : r.status)],
    ['Candidate', (r) => r.senses.candidate],
    ['Confirmed', (r) => r.senses.confirmed],
    ['Rejected', (r) => r.senses.rejected],
    ['Open reports', (r) => r.open_reports],
    ['Created', (r) => ymd(r.created_at)],
  ],
});
await startAdminPage(table.load);
