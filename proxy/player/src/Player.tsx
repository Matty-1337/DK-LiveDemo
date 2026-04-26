import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchDemo, DemoNotFoundError } from './lib/api';
import type { Screen, Story } from './lib/types';
import { isPopulatedScreen } from './lib/types';
import { ScreenCanvas } from './components/ScreenCanvas';
import { Navigation } from './components/Navigation';
import { LoadingState } from './components/LoadingState';
import { ErrorState } from './components/ErrorState';

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; story: Story; screens: Screen[] }
  | { kind: 'error'; message: string };

function normalizeScreens(story: Story): Screen[] {
  const raw = story.screens ?? [];
  const populated = (raw as (Screen | string)[]).filter(isPopulatedScreen);
  return populated
    .slice()
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
}

export function Player() {
  const { storyId } = useParams<{ storyId: string }>();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!storyId) {
      setState({ kind: 'error', message: 'Missing demo id.' });
      return;
    }
    let cancelled = false;
    setState({ kind: 'loading' });
    fetchDemo(storyId)
      .then((story) => {
        if (cancelled) return;
        const screens = normalizeScreens(story);
        if (screens.length === 0) {
          setState({ kind: 'error', message: 'This demo has no screens yet.' });
          return;
        }
        setState({ kind: 'ready', story, screens });
        setCurrent(0);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof DemoNotFoundError
            ? 'The link may be invalid, expired, or unpublished.'
            : (err instanceof Error ? err.message : 'Unknown error');
        setState({ kind: 'error', message });
      });
    return () => { cancelled = true; };
  }, [storyId]);

  // Keep document title + OG image in sync once the demo loads.
  useEffect(() => {
    if (state.kind !== 'ready') return;
    const name = state.story.name ?? 'Live Demo';
    document.title = `${name} — Delta Kinetics`;
    const ogImage = state.screens[0]?.imageUrl;
    if (ogImage) {
      let tag = document.querySelector<HTMLMetaElement>('meta[property="og:image"]');
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('property', 'og:image');
        document.head.appendChild(tag);
      }
      tag.content = ogImage;
    }
  }, [state]);

  const total = state.kind === 'ready' ? state.screens.length : 0;

  const goNext = useCallback(() => {
    setCurrent((c) => Math.min(c + 1, Math.max(0, total - 1)));
  }, [total]);

  const goPrev = useCallback(() => {
    setCurrent((c) => Math.max(0, c - 1));
  }, []);

  // Keyboard navigation: ←/→/space.
  useEffect(() => {
    if (state.kind !== 'ready') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target && (e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goNext(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, goNext, goPrev]);

  const screen = useMemo(
    () => (state.kind === 'ready' ? state.screens[current] : undefined),
    [state, current],
  );

  if (state.kind === 'loading') return <LoadingState />;
  if (state.kind === 'error') return <ErrorState message={state.message} />;
  if (!screen) return <ErrorState message="Could not render screen." />;

  const isLast = current === state.screens.length - 1;

  return (
    <div className="dk-player">
      <ScreenCanvas
        screen={screen}
        isLast={isLast}
        onAdvance={isLast ? () => { /* end */ } : goNext}
      />
      <Navigation
        current={current}
        total={state.screens.length}
        onPrev={goPrev}
        onNext={goNext}
      />
      <div className="dk-watermark" aria-hidden="true">
        <span className="dk-watermark__delta">Δ</span>
        <span className="dk-watermark__text">Delta Kinetics</span>
      </div>
    </div>
  );
}
