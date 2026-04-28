import type { PopupAlignment, PopupButton, PopupView } from '../lib/types';

interface Props {
  popup: PopupView;
  isLast: boolean;
  onAdvance: () => void;
}

function alignmentClass(a?: PopupAlignment): string {
  switch (a) {
    case 'left': return 'dk-popup--left';
    case 'right': return 'dk-popup--right';
    case 'center':
    default: return 'dk-popup--center';
  }
}

function PopupActionButton({ btn, isLast, onAdvance }: {
  btn: PopupButton;
  isLast: boolean;
  onAdvance: () => void;
}) {
  const isWebsite = btn.gotoType === 'website' && btn.gotoWebsite;
  const isCta = isWebsite && (isLast || (btn.text || '').length > 0);

  if (isWebsite) {
    return (
      <a
        href={btn.gotoWebsite}
        target="_blank"
        rel="noopener noreferrer"
        className={`dk-popup__btn ${isCta ? 'dk-popup__btn--cta' : ''}`}
        style={{
          color: btn.textColor,
          background: btn.backgroundColor,
        }}
      >
        {btn.text || 'Continue'}
      </a>
    );
  }

  // 'next' | 'screen' | 'none' — all treated as "advance" inside the player.
  return (
    <button
      type="button"
      onClick={onAdvance}
      className="dk-popup__btn"
      style={{
        color: btn.textColor,
        background: btn.backgroundColor,
      }}
    >
      {btn.text || 'Next'}
    </button>
  );
}

export function Popup({ popup, isLast, onAdvance }: Props) {
  const buttons = popup.buttons ?? [];
  const title = popup.title ?? '';
  const description = popup.description ?? '';

  return (
    <div className={`dk-popup ${alignmentClass(popup.alignment)}`}>
      <div className="dk-popup__card" role="dialog" aria-labelledby="dk-popup-title">
        {title && (
          <h2 id="dk-popup-title" className="dk-popup__title">
            {title}
          </h2>
        )}
        {description && (
          <div
            className="dk-popup__body"
            // Backend stores description as sanitized HTML produced by the
            // personalizer. Render it as HTML so links and emphasis come
            // through. The personalizer is the trust boundary.
            dangerouslySetInnerHTML={{ __html: description }}
          />
        )}
        {buttons.length > 0 && (
          <div className="dk-popup__actions">
            {buttons.map((btn, i) => (
              <PopupActionButton
                key={i}
                btn={btn}
                isLast={isLast}
                onAdvance={onAdvance}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
