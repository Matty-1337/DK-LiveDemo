import type { Story } from './types';

export class DemoNotFoundError extends Error {
  constructor(public storyId: string) {
    super(`Demo ${storyId} not found`);
    this.name = 'DemoNotFoundError';
  }
}

export async function fetchDemo(storyId: string): Promise<Story> {
  const r = await fetch(`/api/v1/demos/${encodeURIComponent(storyId)}`, {
    headers: { Accept: 'application/json' },
  });
  if (r.status === 404) throw new DemoNotFoundError(storyId);
  if (!r.ok) throw new Error(`Demo fetch failed: ${r.status} ${r.statusText}`);
  return r.json();
}
