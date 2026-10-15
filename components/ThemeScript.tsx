"use client";

import { FIXED_THEME_PATHS } from "@lib/themeScope";

// Roda antes da pintura: aplica o tema salvo, exceto nas telas de autenticação, que ficam sempre escuras.
const FIXED_PATHS = JSON.stringify(FIXED_THEME_PATHS);

export default function ThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
(function() {
  try {
    var saved = localStorage.getItem('theme');
    if (saved !== 'light' && saved !== 'dark' && saved !== 'system') saved = 'system';
    var path = location.pathname;
    var fixed = ${FIXED_PATHS}.some(function(p) { return path === p || path.indexOf(p + '/') === 0; });
    var dark = fixed || (saved === 'dark' ||
      (saved === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches));
    var root = document.documentElement;
    if (dark) root.classList.add('dark'); else root.classList.remove('dark');
    root.dataset.theme = saved;
    root.style.colorScheme = dark ? 'dark' : 'light';
  } catch(e) {}
})();`,
      }}
    />
  );
}
