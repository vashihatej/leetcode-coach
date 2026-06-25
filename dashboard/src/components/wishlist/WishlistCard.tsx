import { useState, useRef } from 'react';
import { ExternalLink, Check } from 'lucide-react';
import { useUpdateWishlistNotes, useRemoveWishlist } from '../../hooks/useWishlist';
import type { WishlistItem } from '../../lib/types';

const DIFF: Record<string, string> = {
  Easy: 'text-green-400',
  Medium: 'text-amber-400',
  Hard: 'text-red-400',
};

export default function WishlistCard({ item }: { item: WishlistItem }) {
  const diff = item.prob_difficulty ?? item.difficulty ?? null;
  const updateNotes = useUpdateWishlistNotes();
  const remove = useRemoveWishlist();
  const [notes, setNotes] = useState(item.notes ?? '');
  const originalRef = useRef(item.notes ?? '');

  function handleBlur() {
    if (notes !== originalRef.current) {
      originalRef.current = notes;
      updateNotes.mutate({ slug: item.slug, notes });
    }
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 flex flex-col gap-3">
      <div className="flex justify-between items-start gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-white truncate">
            {item.title ?? item.slug}
          </span>
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="text-gray-500 hover:text-indigo-400 flex-shrink-0"
            >
              <ExternalLink size={13} />
            </a>
          )}
        </div>
        {diff && (
          <span className={`text-xs flex-shrink-0 ${DIFF[diff] ?? 'text-gray-400'}`}>
            {diff}
          </span>
        )}
      </div>

      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        onBlur={handleBlur}
        placeholder="Add notes…"
        rows={2}
        className="w-full bg-gray-700/40 border border-gray-600 rounded-lg px-3 py-2 text-xs text-gray-300 placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
      />

      <button
        onClick={() => remove.mutate(item.slug)}
        className="flex items-center gap-1.5 self-start text-xs text-gray-400 hover:text-green-400 transition-colors"
      >
        <Check size={13} />
        Mark as done
      </button>
    </div>
  );
}
