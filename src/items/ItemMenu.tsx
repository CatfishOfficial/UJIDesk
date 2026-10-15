import { useWorkspace } from '../state/store';
import { TOOLS } from '../data/tools';
import { MenuChip, MenuChips, MenuSeparator } from '../components/ui/ContextMenu';

/**
 * Items are frameless, interactable objects on the desk (the fishbowl, the
 * clock). Each has its own right-click menu; this is the part they all share:
 * size, tuck away (back into the bag), and put away (close).
 */
export const ITEM_SIZES = [
  { id: 'S', label: 'Small', scale: 2 / 3 },
  { id: 'M', label: 'Medium', scale: 1 },
  { id: 'L', label: 'Large', scale: 3 / 2 },
];

export function ItemMenuFooter({ winId, onClose, putAwayLabel = 'Put away' }: { winId: string; onClose: () => void; putAwayLabel?: string }) {
  const win = useWorkspace((s) => s.windows[winId]);
  const setRect = useWorkspace((s) => s.setRect);
  const minimize = useWorkspace((s) => s.minimize);
  const closeWindow = useWorkspace((s) => s.closeWindow);
  if (!win) return null;
  const meta = TOOLS[win.type];
  const aspect = meta.aspect ?? win.w / win.h;
  return (
    <>
      <MenuSeparator />
      <div className="ctx-inline">
        <span className="ctx-inline-label">Size</span>
        <MenuChips label="Size">
          {ITEM_SIZES.map((s) => {
            const w = Math.round(meta.size.w * s.scale);
            return (
              <MenuChip
                key={s.id}
                kind="menuitemradio"
                checked={Math.abs(win.w - w) < 24}
                title={s.label}
                onSelect={() => {
                  setRect(winId, { w, h: Math.round(w / aspect) });
                  onClose();
                }}
              >
                {s.id}
              </MenuChip>
            );
          })}
        </MenuChips>
      </div>
      <MenuChips label="Put away">
        <MenuChip title="Back in the bag" onSelect={() => (minimize(winId), onClose())}>
          Tuck away
        </MenuChip>
        <MenuChip onSelect={() => (closeWindow(winId), onClose())}>{putAwayLabel}</MenuChip>
      </MenuChips>
    </>
  );
}
