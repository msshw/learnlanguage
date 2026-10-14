import { startAdminPage } from '../lib/admin-guard.js';
import { mountTable, usd } from '../lib/admin-table.js';

const table = mountTable({
  action: 'list_ai_calls',
  emptyText: 'No AI calls',
  columns: [
    ['Time', (r) => new Date(r.created_at).toLocaleString()],
    ['User', (r) => r.email],
    ['Kind', (r) => r.kind],
    ['Model', (r) => r.model],
    ['Input tokens', (r) => r.input_tokens],
    ['Output tokens', (r) => r.output_tokens],
    ['Cost', (r) => usd(r.cost_usd)],
    ['Duration', (r) => `${r.latency_ms} ms`],
    ['Result', (r) => (r.ok ? 'OK' : 'Failed')],
  ],
});
await startAdminPage(table.load);
