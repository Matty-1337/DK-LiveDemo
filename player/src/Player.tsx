import { useParams } from 'react-router-dom';

export function Player() {
  const { storyId } = useParams<{ storyId: string }>();
  return (
    <main style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      fontFamily: 'var(--dk-font-mono)',
      color: 'var(--dk-text-muted)',
    }}>
      Player scaffold — story {storyId}
    </main>
  );
}
