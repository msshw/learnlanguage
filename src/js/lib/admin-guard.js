import { requireSession } from './auth.js';
import { invokeAdmin } from './db.js';

const $ = (selector) => document.querySelector(selector);

// A non-admin sees only "Not available": no sub-navigation, no page content.
export function showForbidden() {
  $('#forbidden').hidden = false;
  $('#admin-body').hidden = true;
  $('#admin-nav').hidden = true;
}

// The number for the Reports pill: a count, null when the read fails, or 'forbidden'.
async function reportCount() {
  try {
    const result = await invokeAdmin({ action: 'report_count' });
    if (result.status === 'forbidden') return 'forbidden';
    return result.status === 'ok' && Number.isInteger(result.count) ? result.count : null;
  } catch {
    return null;
  }
}

// Runs the page's own load (it returns 'forbidden' for a non-admin) next to the pill count.
// The sub-navigation stays hidden until neither answer says forbidden.
export async function startAdminPage(load) {
  await requireSession();
  const [own, count] = await Promise.all([load(), reportCount()]);
  if (own === 'forbidden' || count === 'forbidden') return showForbidden();
  $('#admin-nav').hidden = false;
  const pill = $('#nav-reports');
  if (typeof count === 'number' && count > 0) {
    pill.textContent = String(count);
    pill.hidden = false;
  }
}
