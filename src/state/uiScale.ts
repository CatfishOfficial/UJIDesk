import { useEffect } from 'react';
import { useWorkspace } from './store';

/** Applies Settings → Text size to the page as the --ui-scale custom property .stage scales by. */
export function useApplyUIScale() {
  const scale = useWorkspace((s) => s.settings.uiScale) ?? 1;
  useEffect(() => {
    document.documentElement.style.setProperty('--ui-scale', String(scale));
  }, [scale]);
}
