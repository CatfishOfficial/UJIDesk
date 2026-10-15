import { useEffect } from 'react';
import { useWorkspace } from './store';
import { timeOfDay } from '../game/ship';
import type { ThemeChoice } from './types';

export function resolveTheme(choice: ThemeChoice, now: Date = new Date()): 'light' | 'dark' {
  if (choice === 'dynamic') return timeOfDay(now) === 'night' ? 'dark' : 'light';
  return choice;
}

/** Applies the chosen theme to the page, re-checking the clock each minute for Dynamic. */
export function useApplyTheme() {
  const choice = useWorkspace((s) => s.settings.theme) ?? 'light';
  useEffect(() => {
    const apply = () => {
      const theme = resolveTheme(choice);
      document.documentElement.dataset.theme = theme;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#16161b' : '#fbfaf6');
    };
    apply();
    if (choice !== 'dynamic') return;
    const t = window.setInterval(apply, 60_000);
    return () => window.clearInterval(t);
  }, [choice]);
}
