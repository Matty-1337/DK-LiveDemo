interface Props {
  message?: string;
}

export function ErrorState({ message }: Props) {
  return (
    <main className="dk-state">
      <div className="dk-state__card" role="alert">
        <div className="dk-state__eyebrow">Δ Live demo</div>
        <h1 className="dk-state__title">This demo couldn&apos;t be loaded</h1>
        <p className="dk-state__body">
          {message ?? 'The link may be invalid, expired, or unpublished.'}
        </p>
        <p className="dk-state__body">
          If you were expecting to see something here, email{' '}
          <a href="mailto:support@deltakinetics.io">support@deltakinetics.io</a>
          {' '}and we&apos;ll get you a fresh link.
        </p>
      </div>
    </main>
  );
}
