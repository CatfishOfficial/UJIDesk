/**
 * The current overall UI scale (Settings → Display size), read straight off the
 * --ui-scale custom property useApplyUIScale keeps on <html>. Dependency-free (no
 * import of ./store) so placement/geometry math — which store.ts imports — can
 * read it without a circular import.
 *
 * Why this is needed at all: --ui-scale is applied via `zoom` on <html>, which
 * rescales rendering only. window.innerWidth/innerHeight, event.clientX/clientY
 * and window.screen.* keep reporting true, unscaled page pixels — they do NOT
 * remap the way native browser zoom would. Anywhere one of those "real" numbers
 * is combined with persisted state (window/button/sticker x, y, w, h — "logical"
 * pixels that get rendered through the zoom) or assigned straight into a
 * style.left/top/width/height inside the zoomed page, it must be divided by this
 * scale first, or things drift from the true edges and from the pointer as the
 * scale moves away from 1.
 */
export function currentScale(): number {
  if (typeof document === 'undefined') return 1;
  const n = parseFloat(document.documentElement.style.getPropertyValue('--ui-scale'));
  return Number.isFinite(n) && n > 0 ? n : 1;
}
