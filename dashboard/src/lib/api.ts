import type {
  Problem, Attempt, Pattern, ReviewItem, ActivityPoint,
  Stats, WishlistItem, RecentAttempt,
} from './types';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(path, { method: 'DELETE' });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  stats: () => get<Stats>('/api/stats'),
  problems: () => get<Problem[]>('/api/problems'),
  attempts: (slug: string) => get<Attempt[]>(`/api/problems/${slug}/attempts`),
  patterns: () => get<Pattern[]>('/api/patterns'),
  patternProblems: (name: string) =>
    get<Problem[]>(`/api/patterns/${encodeURIComponent(name)}/problems`),
  reviewDue: () => get<ReviewItem[]>('/api/review/due'),
  activity: () => get<ActivityPoint[]>('/api/activity'),
  recentAttempts: () => get<RecentAttempt[]>('/api/recent-attempts'),
  wishlist: () => get<WishlistItem[]>('/api/wishlist'),
  addWishlist: (item: { slug: string; url?: string; title?: string; difficulty?: string }) =>
    post<{ ok: boolean }>('/api/wishlist', item),
  updateWishlistNotes: (slug: string, notes: string) =>
    patch<{ ok: boolean }>(`/api/wishlist/${slug}`, { notes }),
  removeWishlist: (slug: string) => del<{ ok: boolean }>(`/api/wishlist/${slug}`),
};
