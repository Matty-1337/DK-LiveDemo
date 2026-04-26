interface Props {
  current: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}

export function Navigation({ current, total, onPrev, onNext }: Props) {
  const atStart = current <= 0;
  const atEnd = current >= total - 1;

  return (
    <nav className="dk-nav" aria-label="Demo navigation">
      <button
        type="button"
        className="dk-nav__btn"
        onClick={onPrev}
        disabled={atStart}
        aria-label="Previous screen"
      >
        ← Prev
      </button>
      <ol className="dk-nav__dots" aria-label={`Screen ${current + 1} of ${total}`}>
        {Array.from({ length: total }).map((_, i) => (
          <li
            key={i}
            className={`dk-nav__dot ${i === current ? 'dk-nav__dot--active' : ''} ${i < current ? 'dk-nav__dot--past' : ''}`}
            aria-current={i === current ? 'step' : undefined}
          />
        ))}
      </ol>
      <button
        type="button"
        className="dk-nav__btn"
        onClick={onNext}
        disabled={atEnd}
        aria-label="Next screen"
      >
        Next →
      </button>
    </nav>
  );
}
