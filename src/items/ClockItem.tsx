import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWindowData } from '../state/store';
import { PixelCanvas } from '../data/pixelCanvas';
import { pixelRects } from '../data/pixel';
import { ContextMenu, MenuItem, MenuLabel, MenuSeparator } from '../components/ui/ContextMenu';
import { ItemMenuFooter } from './ItemMenu';
import { drawDigit } from './sevenSeg';

export const CLOCK_W = 80;
export const CLOCK_H = 34;

type Look = 'retro' | 'modern';
interface ClockData extends Record<string, unknown> {
  look: Look;
  h24: boolean;
}

const PAL = {
  K: '#1a1412',
  // 80s: dark plastic, red LEDs
  p: '#2b2726',
  P: '#3d3836',
  q: '#1d1a19',
  x: '#0e0a0a',
  r: '#ff3b2f',
  o: '#2a0e0c',
  // modern: theme tokens
  m: 'var(--clock-modern-body)',
  M: 'var(--clock-modern-edge)',
  n: 'var(--clock-modern-shade)',
  d: 'var(--clock-modern-digit)',
  e: 'var(--clock-modern-dim)',
  a: 'var(--accent)',
};

function retroBody(): string[] {
  const c = new PixelCanvas(CLOCK_W, CLOCK_H);
  // snooze bar on top
  c.rect(26, 1, 53, 3, 'q');
  c.hline(27, 52, 1, 'P');
  // all-plastic body with rounded corners
  c.rect(2, 4, 77, 31, 'p');
  c.rect(1, 5, 78, 30, 'p');
  // molded top edge: a highlight, then a seam
  c.hline(3, 76, 4, 'P');
  c.hline(2, 77, 5, 'P');
  c.hline(1, 78, 9, 'q');
  // the recessed LED window
  c.rect(6, 12, 73, 29, 'x');
  c.hline(6, 73, 12, 'q');
  // little feet
  c.rect(6, 32, 11, 33, 'q');
  c.rect(68, 32, 73, 33, 'q');
  c.outline('K');
  return c.rows();
}

function modernBody(): string[] {
  const c = new PixelCanvas(CLOCK_W, CLOCK_H);
  c.rect(3, 3, 76, 30, 'm');
  c.rect(2, 4, 77, 29, 'm');
  c.rect(1, 6, 78, 27, 'm');
  // soft lower shade, like a matte edge
  c.hline(3, 76, 30, 'n');
  c.hline(2, 77, 29, 'n');
  c.outline('M');
  return c.rows();
}

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function digitsFor(now: Date, h24: boolean): { text: string; pm: boolean } {
  let h = now.getHours();
  const pm = h >= 12;
  if (!h24) h = h % 12 || 12;
  const hh = h24 ? String(h).padStart(2, '0') : String(h).padStart(2, ' ');
  return { text: hh + String(now.getMinutes()).padStart(2, '0'), pm };
}

function retroFace(now: Date, h24: boolean): string[] {
  const c = new PixelCanvas(CLOCK_W, CLOCK_H);
  const { text, pm } = digitsFor(now, h24);
  const xs = [10, 21, 37, 48];
  // Unlit segments stay faintly visible, like a real LED clock.
  text.split('').forEach((ch, i) => drawDigit(c, ch, xs[i], 15, 9, 12, 2, 'r', 'o'));
  // blinking colon
  const colon = now.getSeconds() % 2 === 0 ? 'r' : 'o';
  c.rect(32, 17, 33, 18, colon);
  c.rect(32, 22, 33, 23, colon);
  // AM / PM lights
  if (!h24) {
    c.text('am', 61, 15, pm ? 'o' : 'r');
    c.text('pm', 61, 22, pm ? 'r' : 'o');
  }
  return c.rows();
}

function modernFace(now: Date, h24: boolean): string[] {
  const c = new PixelCanvas(CLOCK_W, CLOCK_H);
  const { text, pm } = digitsFor(now, h24);
  const xs = [14, 24, 40, 50];
  text.split('').forEach((ch, i) => drawDigit(c, ch, xs[i], 7, 8, 13, 1, 'd'));
  c.px(35, 10, 'd');
  c.px(35, 16, 'd');
  if (!h24) c.text(pm ? 'pm' : 'am', 61, 8, 'e');
  // date, small
  const date = `${DAYS[now.getDay()]} ${MONTHS[now.getMonth()]} ${now.getDate()}`;
  c.text(date, 14, 22, 'e');
  // a thin bar that fills across the minute
  const w = Math.round(((now.getSeconds() + 1) / 60) * 50);
  c.hline(14, 63, 28, 'n');
  if (w > 0) c.hline(14, 13 + w, 28, 'a');
  return c.rows();
}

/**
 * A desk clock item. Right-click to switch between an 80s LED alarm clock and
 * a modern slab, or between 12- and 24-hour time.
 */
export function ClockItem({ winId }: { winId: string }) {
  const [d, update] = useWindowData<ClockData>(winId);
  const look: Look = d.look ?? 'retro';
  const h24 = !!d.h24;
  const [now, setNow] = useState(() => new Date());
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setMenu(null), []);

  useEffect(() => {
    // tick on the second boundary
    let t = 0;
    const tick = () => {
      setNow(new Date());
      t = window.setTimeout(tick, 1000 - (Date.now() % 1000));
    };
    t = window.setTimeout(tick, 1000 - (Date.now() % 1000));
    return () => window.clearTimeout(t);
  }, []);

  const body = useMemo(() => pixelRects(look === 'retro' ? retroBody() : modernBody(), PAL, 0, 0, 'body'), [look]);
  const face = pixelRects(look === 'retro' ? retroFace(now, h24) : modernFace(now, h24), PAL, 0, 0, 'face');
  const spoken = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: !h24 });

  return (
    <div
      ref={rootRef}
      className={`clock-object is-${look}`}
      tabIndex={0}
      role="timer"
      aria-label={`Clock, ${spoken}. The menu key or Shift+F10 opens clock options; arrow keys move it.`}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
      onKeyDown={(e) => {
        if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
          e.preventDefault();
          const r = rootRef.current?.getBoundingClientRect();
          if (r) setMenu({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
        }
      }}
    >
      <svg viewBox={`0 0 ${CLOCK_W} ${CLOCK_H}`} shapeRendering="crispEdges" className="pixel clock-svg" aria-hidden="true">
        {body}
        {face}
      </svg>
      {menu && (
        <ContextMenu x={menu.x} y={menu.y} label="Clock options" onClose={closeMenu}>
          <div className="ctx-head">
            <div>
              <div className="ctx-head-name">{spoken}</div>
              <div className="ctx-head-desc">{now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</div>
            </div>
          </div>
          <MenuSeparator />
          <MenuLabel>Look</MenuLabel>
          <MenuItem checked={look === 'retro'} onSelect={() => (update({ look: 'retro' }), closeMenu())} hint="red LEDs">
            80s alarm clock
          </MenuItem>
          <MenuItem checked={look === 'modern'} onSelect={() => (update({ look: 'modern' }), closeMenu())} hint="clean slab">
            Modern
          </MenuItem>
          <MenuSeparator />
          <MenuLabel>Time</MenuLabel>
          <MenuItem checked={!h24} onSelect={() => (update({ h24: false }), closeMenu())}>
            12-hour
          </MenuItem>
          <MenuItem checked={h24} onSelect={() => (update({ h24: true }), closeMenu())}>
            24-hour
          </MenuItem>
          <ItemMenuFooter winId={winId} onClose={closeMenu} />
        </ContextMenu>
      )}
    </div>
  );
}
