import { LayoutGrid, Settings2 } from 'lucide-react';
import { useWorkspace } from '../state/store';
import { useUI } from '../state/ui';
import { DEFAULT_ARRANGE, type ArrangeSettings } from '../state/snap';
import { ContextMenu, MenuItem, MenuLabel, MenuSeparator } from './ui/ContextMenu';

/** Right-click on the empty whiteboard: tidy the windows, and the arrangement toggles. */
export function BoardMenu({ x, y, onClose }: { x: number; y: number; onClose: () => void }) {
  const tidyUp = useWorkspace((s) => s.tidyUp);
  const open = useWorkspace((s) => Object.values(s.windows).filter((w) => !w.minimized).length);
  const arrange = useWorkspace((s) => s.settings.arrange ?? DEFAULT_ARRANGE);
  const setSettings = useWorkspace((s) => s.setSettings);
  const setBackpack = useUI((s) => s.setBackpack);
  const flip = (k: keyof Pick<ArrangeSettings, 'grid' | 'windows' | 'guides'>) => setSettings({ arrange: { ...arrange, [k]: !arrange[k] } });
  return (
    <ContextMenu x={x} y={y} label="Whiteboard options" onClose={onClose}>
      <MenuItem
        icon={<LayoutGrid size={14} />}
        disabled={!open}
        hint={open ? undefined : 'nothing open'}
        onSelect={() => {
          onClose();
          tidyUp();
        }}
      >
        Tidy up windows
      </MenuItem>
      <MenuSeparator />
      <MenuLabel>Window arrangement</MenuLabel>
      <MenuItem checked={arrange.grid} onSelect={() => flip('grid')} hint={`${arrange.gridSize}px`}>
        Snap to grid
      </MenuItem>
      <MenuItem checked={arrange.windows} onSelect={() => flip('windows')}>
        Snap to windows
      </MenuItem>
      <MenuItem checked={arrange.guides} onSelect={() => flip('guides')}>
        Alignment guides
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        icon={<Settings2 size={14} />}
        onSelect={() => {
          onClose();
          setBackpack(true, 'settings');
        }}
      >
        Arrangement settings…
      </MenuItem>
    </ContextMenu>
  );
}
