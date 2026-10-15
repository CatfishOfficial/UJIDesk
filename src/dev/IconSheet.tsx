import { PIXEL_ICON_NAMES, PixelIcon } from '../components/ui/pixel-icons/PixelIcon';

/** Dev-only contact sheet for reviewing the icon set: open /?icons */
export function IconSheet() {
  return (
    <div style={{ padding: 24, display: 'flex', flexWrap: 'wrap', gap: 18, background: '#faf9f6', height: '100vh', overflow: 'auto', alignContent: 'flex-start' }}>
      {PIXEL_ICON_NAMES.map((n) => (
        <figure key={n} style={{ margin: 0, width: 96, textAlign: 'center', fontSize: 11 }}>
          <PixelIcon name={n} size={64} />
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'end', marginTop: 4 }}>
            <PixelIcon name={n} size={32} />
            <PixelIcon name={n} size={16} />
          </div>
          <figcaption>{n}</figcaption>
        </figure>
      ))}
    </div>
  );
}
