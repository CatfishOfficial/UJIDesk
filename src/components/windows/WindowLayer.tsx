import type { ReactNode } from 'react';
import { useWorkspace } from '../../state/store';
import type { Win } from '../../state/types';
import { FloatingWindow } from './FloatingWindow';
import { BareObject } from './BareObject';
import { TOOLS } from '../../data/tools';
import { TripOnDaShip } from '../../game/TripOnDaShip';
import { ClockItem } from '../../items/ClockItem';
import { PeriodicTableTool } from '../../science/PeriodicTableTool';
import { NuclearDecayTool } from '../../science/NuclearDecayTool';
import { ElectronConfigTool } from '../../science/ElectronConfigTool';
import { StandardToSlopeTool } from '../tools/StandardToSlopeTool';
import { SlopeFromPointsTool } from '../tools/SlopeFromPointsTool';
import { CalculatorTool } from '../tools/CalculatorTool';
import { GraphTool } from '../tools/GraphTool';
import { ScratchpadTool } from '../tools/ScratchpadTool';
import { StickyNoteTool, stickyPaper } from '../tools/StickyNoteTool';
import { ReferenceTool } from '../tools/ReferenceTool';
import { TimerTool } from '../tools/TimerTool';
import { RulerTool } from '../tools/RulerTool';
import { FishbowlTool } from '../tools/FishbowlTool';
import { ChallengeTool } from '../tools/ChallengeTool';
import { PointSlopeTool } from '../tools/PointSlopeTool';
import { SystemsTool } from '../tools/SystemsTool';
import { QuadraticTool } from '../tools/QuadraticTool';
import { FactoringTool } from '../tools/FactoringTool';
import { PythagTool } from '../tools/PythagTool';
import { AreaTool } from '../tools/AreaTool';
import { TrigTool } from '../tools/TrigTool';
import { StatsTool } from '../tools/StatsTool';
import { SequencesTool } from '../tools/SequencesTool';

function body(win: Win): ReactNode {
  switch (win.type) {
    case 'standardToSlope':
      return <StandardToSlopeTool winId={win.id} />;
    case 'slopeFromPoints':
      return <SlopeFromPointsTool winId={win.id} />;
    case 'calculator':
      return <CalculatorTool winId={win.id} />;
    case 'graph':
      return <GraphTool winId={win.id} />;
    case 'scratchpad':
      return <ScratchpadTool winId={win.id} />;
    case 'sticky':
      return <StickyNoteTool winId={win.id} />;
    case 'reference':
      return <ReferenceTool winId={win.id} />;
    case 'timer':
      return <TimerTool winId={win.id} />;
    case 'ruler':
      return <RulerTool winId={win.id} />;
    case 'fishbowl':
      return <FishbowlTool winId={win.id} />;
    case 'challenge':
      return <ChallengeTool winId={win.id} />;
    case 'tripOnDaShip':
      return <TripOnDaShip winId={win.id} />;
    case 'clock':
      return <ClockItem winId={win.id} />;
    case 'periodicTable':
      return <PeriodicTableTool winId={win.id} />;
    case 'nuclearDecay':
      return <NuclearDecayTool winId={win.id} />;
    case 'electronConfig':
      return <ElectronConfigTool winId={win.id} />;
    case 'pointSlope':
      return <PointSlopeTool winId={win.id} />;
    case 'systems':
      return <SystemsTool winId={win.id} />;
    case 'quadratic':
      return <QuadraticTool winId={win.id} />;
    case 'factoring':
      return <FactoringTool winId={win.id} />;
    case 'pythag':
      return <PythagTool winId={win.id} />;
    case 'area':
      return <AreaTool winId={win.id} />;
    case 'trig':
      return <TrigTool winId={win.id} />;
    case 'stats':
      return <StatsTool winId={win.id} />;
    case 'sequences':
      return <SequencesTool winId={win.id} />;
  }
}

export function WindowLayer({ compact }: { compact: boolean }) {
  const windows = useWorkspace((s) => s.windows);
  const list = Object.values(windows).sort((a, b) => a.id.localeCompare(b.id));
  // On small screens one window is in front at a time; the backpack lists them all.
  const front = compact ? Object.values(windows).filter((w) => !w.minimized && TOOLS[w.type].chrome !== 'bare').sort((a, b) => b.z - a.z)[0]?.id : undefined;

  return (
    <div className="window-layer">
      {list.map((w) =>
        TOOLS[w.type].chrome === 'bare' ? (
          // Frameless desk objects float even on small screens.
          <BareObject key={w.id} win={w} label={TOOLS[w.type].title}>
            {body(w)}
          </BareObject>
        ) : (
        <FloatingWindow
          key={w.id}
          win={w}
          compact={compact}
          compactHidden={compact && w.id !== front}
          headerStyle={w.type === 'sticky' ? { background: stickyPaper(w.data.color) } : undefined}
        >
          {body(w)}
        </FloatingWindow>
        ),
      )}
    </div>
  );
}
