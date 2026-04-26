import type { Screen } from '../lib/types';
import { Popup } from './Popup';

interface Props {
  screen: Screen;
  isLast: boolean;
  onAdvance: () => void;
}

export function ScreenCanvas({ screen, isLast, onAdvance }: Props) {
  // The seeded popup-style step is steps[0] (see upstream-data-model.md
  // — every new screen auto-seeds a default popup step). The MCP
  // generator personalizes that step in place. We render only that one.
  const step = screen.steps?.[0];
  const popup = step?.view?.viewType === 'popup' ? step.view.popup : undefined;

  return (
    <div className="dk-canvas" key={screen._id}>
      {screen.imageUrl ? (
        <img
          className="dk-canvas__bg"
          src={screen.imageUrl}
          alt={screen.name ?? 'Demo screen'}
          draggable={false}
        />
      ) : (
        <div className="dk-canvas__bg dk-canvas__bg--missing" aria-hidden="true" />
      )}
      {popup && (
        <Popup popup={popup} isLast={isLast} onAdvance={onAdvance} />
      )}
    </div>
  );
}
