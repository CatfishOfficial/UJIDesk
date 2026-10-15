import type { ReactNode } from 'react';
import { Pixel } from './pixel';
import { PixelIcon } from '../components/ui/pixel-icons/PixelIcon';

export interface ArcadeGame {
  id: string;
  name: string;
  desc: string;
  art: ReactNode;
  /** Playable now, or a placeholder for later. */
  ready: boolean;
}

export const ARCADE: ArcadeGame[] = [
  {
    id: 'trip',
    name: 'Trip on da Ship',
    desc: 'Buy a ticket with tokens, sail into the open sea, and catch fish for your bowl. Day and night trips follow your real clock.',
    art: <PixelIcon name="boat" size={48} />,
    ready: true,
  },
  {
    id: 'casino',
    name: 'Lucky River Casino',
    desc: 'Absurdly serious games for unserious stakes. Chips are pretend, have no cash value, and nothing is for sale. There is no cashier.',
    art: <Pixel size={40} palette={{ g: '#4f8f6c', w: '#f4f1ea', k: '#2d2b33' }} rows={['.gggggg.', 'gwwggwwg', 'gwkggwkg', 'gggggggg', 'gwwggwwg', 'gwkggwkg', '.gggggg.']} />,
    ready: false,
  },
  {
    id: 'ikae',
    name: 'Ikae',
    desc: 'Flat-pack furniture for your room and your fish. Assembly instructions are pictograms of a confused man.',
    art: <Pixel size={44} palette={{ y: '#e8c34f', b: '#5a74b8', w: '#f4f1ea' }} rows={['bbbbbbbbbb', 'byyyyyyyyb', 'bywwwwwwyb', 'byyyyyyyyb', 'bbbbbbbbbb']} />,
    ready: false,
  },
  {
    id: 'room',
    name: 'Room decor',
    desc: 'A tiny room of your own, furnished with whatever you have earned.',
    art: <Pixel size={40} palette={{ w: '#e3e2f8', f: '#b9a27a', p: '#7c83db' }} rows={['wwwwwwww', 'wwppwwww', 'wwppwwww', 'wwwwwwww', 'ffffffff', 'ffffffff']} />,
    ready: false,
  },
];
