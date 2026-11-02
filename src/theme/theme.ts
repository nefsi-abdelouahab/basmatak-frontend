// Theme persistence shared by the pre-hydration script and ThemeToggle.
// Light is the default; dark is only applied when the visitor explicitly
// chooses it (stored value 'dark'). No prefers-color-scheme fallback.

export const THEME_STORAGE_KEY = 'basmatak-theme';

export type ThemeMode = 'light' | 'dark';

export function normalizeTheme(value: string | null | undefined): ThemeMode {
  return value === 'dark' ? 'dark' : 'light';
}

// Runs before paint so a stored dark choice does not flash the light canvas.
// The inline string keeps the first visit on the light default: no data-theme
// attribute and no media-query branch.
export const themeInitScript = `(function(){try{var value=window.localStorage.getItem('${THEME_STORAGE_KEY}');if(value==='dark'){document.documentElement.setAttribute('data-theme','dark');}else{document.documentElement.removeAttribute('data-theme');}}catch(error){}})();`;
