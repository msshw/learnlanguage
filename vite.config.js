import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import handlebars from 'vite-plugin-handlebars';
import { resolve } from 'node:path';

const projectRoot = import.meta.dirname;
const src = (p) => resolve(projectRoot, 'src', p);

const pages = ['index', 'signin', 'setup', 'review', 'practice', 'add', 'words', 'word', 'settings', 'admin', 'admin-rejected', 'admin-suggestions', 'admin-ai-calls', 'admin-users'];
const adminPages = ['admin-rejected', 'admin-suggestions', 'admin-ai-calls', 'admin-users'];

// code and chip: the Alt shortcut. icon: one 24x24 stroke path for the collapsed sidebar.
const nav = [
  { id: 'index', href: '/', label: 'Home', i18n: 'sidebar.home', code: 'KeyH', chip: 'Alt+H', icon: 'M3 11l9-8 9 8M5 10v10h14V10' },
  { id: 'review', href: '/review.html', label: 'Review', i18n: 'sidebar.review', dueCount: true, code: 'KeyR', chip: 'Alt+R', icon: 'M4 5h16v14H4zM8 10h8M8 14h5' },
  { id: 'practice', href: '/practice.html', label: 'Practice', i18n: 'sidebar.practice', practiceCount: true, code: 'KeyP', chip: 'Alt+P', icon: 'M4 20l4-1 11-11-3-3L5 16zM14 6l3 3' },
  { id: 'add', href: '/add.html', label: 'Add word', i18n: 'sidebar.add', key: 'N', code: 'KeyA', chip: 'Alt+A', icon: 'M12 5v14M5 12h14' },
  { id: 'words', pages: ['word'], href: '/words.html', label: 'Words', i18n: 'sidebar.words', code: 'KeyW', chip: 'Alt+W', icon: 'M4 6h16M4 12h16M4 18h16' },
  { id: 'settings', href: '/settings.html', label: 'Settings', i18n: 'sidebar.settings', code: 'KeyS', chip: 'Alt+S', icon: 'M4 7h10M18 7h2M4 17h2M10 17h10M16 4v6M8 14v6' },
  // Rendered hidden; sidebar.js shows it for admins.
  { id: 'admin', pages: adminPages, href: '/admin.html', label: 'Admin', i18n: 'sidebar.admin', adminOnly: true, code: 'KeyM', chip: 'Alt+M', icon: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z' },
];

// Second sidebar on the admin pages. pill: the open-reports count, filled by admin-guard.js.
const adminNav = [
  { id: 'admin', href: '/admin.html', label: 'Reports', pill: true },
  { id: 'admin-rejected', href: '/admin-rejected.html', label: 'Rejected' },
  { id: 'admin-suggestions', href: '/admin-suggestions.html', label: 'Suggestions' },
  { id: 'admin-ai-calls', href: '/admin-ai-calls.html', label: 'AI calls' },
  { id: 'admin-users', href: '/admin-users.html', label: 'Users' },
];

// Pages are served from src/pages so URLs are /review.html, not /src/pages/review.html.
export default defineConfig({
  root: 'src/pages',
  envDir: '../..',
  publicDir: '../../public',
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: Object.fromEntries(pages.map((p) => [p, src(`pages/${p}.html`)])),
    },
  },
  server: {
    fs: { allow: [projectRoot] },
    // Dev only. `npm run dev:proxy` points the app at /supabase on this server, so a browser that
    // blocks calls from localhost:5173 to 127.0.0.1:54321 only ever talks to one origin.
    proxy: {
      '/supabase': {
        target: 'http://127.0.0.1:54321',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/supabase/, ''),
      },
    },
  },
  plugins: [
    tailwindcss(),
    handlebars({
      partialDirectory: [src('layouts'), src('components')],
      context(pagePath) {
        const page = pagePath.replace(/^\//, '').replace(/\.html$/, '');
        const current = (n) => n.id === page || n.pages?.includes(page);
        return { page, admin: page.startsWith('admin'), nav: nav.map((n) => ({ ...n, current: current(n) })), adminNav: adminNav.map((n) => ({ ...n, current: n.id === page })) };
      },
    }),
  ],
});
