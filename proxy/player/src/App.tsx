import { BrowserRouter, Route, Routes, Link } from 'react-router-dom';
import { Player } from './Player';

function NotFound() {
  return (
    <main style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      padding: '2rem',
      textAlign: 'center',
    }}>
      <div>
        <div style={{
          fontFamily: 'var(--dk-font-mono)',
          fontSize: '0.8rem',
          letterSpacing: '0.18em',
          color: 'var(--dk-cyan)',
          marginBottom: '0.75rem',
        }}>
          404 — Δ
        </div>
        <h1 style={{
          fontSize: '2.25rem',
          margin: '0 0 0.75rem',
          background: 'var(--dk-gradient)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          Demo not found
        </h1>
        <p style={{ color: 'var(--dk-text-muted)', margin: 0 }}>
          The link you followed isn&apos;t a Delta Kinetics live demo.
        </p>
        <p style={{ marginTop: '1.5rem' }}>
          <Link to="/">Back to start</Link>
        </p>
      </div>
    </main>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/livedemos/:storyId" element={<Player />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
