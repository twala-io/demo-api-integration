import { useState } from 'react';

type Theme = 'light' | 'dark';
const KEY = 'showcase.theme';

const saved = (): Theme => {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};

const apply = (t: Theme) => (document.documentElement.dataset.theme = t);

// Applied on load so the page never flashes the wrong theme.
apply(saved());

const MOON = <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />;
const SUN = (
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </>
);

export function ThemeSwitch() {
  const [theme, setTheme] = useState(saved);
  const next: Theme = theme === 'light' ? 'dark' : 'light';
  const toggle = () => {
    setTheme(next);
    apply(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {}
  };
  return (
    <button className="icon-btn" onClick={toggle} title={`Switch to ${next} mode`} aria-label={`Switch to ${next} mode`}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {theme === 'light' ? MOON : SUN}
      </svg>
    </button>
  );
}
