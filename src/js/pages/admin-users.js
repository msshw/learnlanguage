import { startAdminPage } from '../lib/admin-guard.js';
import { mountTable, usd, ymd } from '../lib/admin-table.js';

const table = mountTable({
  action: 'list_users',
  emptyText: 'No users',
  columns: [
    ['Email', (r) => r.email],
    ['Signed up', (r) => ymd(r.created_at)],
    ['Last sign-in', (r) => (r.last_sign_in_at ? ymd(r.last_sign_in_at) : 'Never')],
    ['Admin', (r) => (r.is_admin ? 'Admin' : '')],
    ['Words', (r) => r.words],
    ['Reviews', (r) => r.reviews],
    ['Practice attempts', (r) => r.practice_attempts],
    ['AI calls this month', (r) => r.ai_calls_month],
    ['Cost this month', (r) => usd(r.cost_month_usd)],
  ],
});
await startAdminPage(table.load);
