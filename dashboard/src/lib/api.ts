import type {
  Problem, Attempt, Pattern, ReviewItem, ActivityPoint,
  Stats, WishlistItem, RecentAttempt, PatternWiki,
  ProblemList, ListProblem,
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
  patternWiki: (name: string) =>
    get<PatternWiki | null>(`/api/patterns/${encodeURIComponent(name)}/wiki`),
  reviewDue: () => get<ReviewItem[]>('/api/review/due'),
  activity: () => get<ActivityPoint[]>('/api/activity'),
  recentAttempts: () => get<RecentAttempt[]>('/api/recent-attempts'),
  wishlist: () => get<WishlistItem[]>('/api/wishlist'),
  addWishlist: (item: { slug: string; url?: string; title?: string; difficulty?: string }) =>
    post<{ ok: boolean }>('/api/wishlist', item),
  updateWishlistNotes: (slug: string, notes: string) =>
    patch<{ ok: boolean }>(`/api/wishlist/${slug}`, { notes }),
  removeWishlist: (slug: string) => del<{ ok: boolean }>(`/api/wishlist/${slug}`),
  lists: () => get<ProblemList[]>('/api/lists'),
  listProblems: (id: number) => get<ListProblem[]>(`/api/lists/${id}/problems`),
  createList: (name: string) => post<{ id: number; name: string }>('/api/lists', { name }),
  bulkAddToList: (id: number, text: string) =>
    post<{ inserted: number }>(`/api/lists/${id}/problems/bulk`, { text }),
  deleteList: (id: number) => del<{ ok: boolean }>(`/api/lists/${id}`),
  generateViz: (slug: string) =>
    post<{ ok: boolean; viz_path: string }>(`/api/problems/${slug}/visualize`, {}),

  generateNotes: (slug: string) =>
    post<{ ok: boolean; notes_path: string }>(`/api/problems/${slug}/notes`, {}),
};
