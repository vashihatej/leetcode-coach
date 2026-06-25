import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useAddWishlist } from '../../hooks/useWishlist';

function slugFromUrl(url: string): string | null {
  const m = url.match(/leetcode\.com\/problems\/([^/?#]+)/);
  return m ? m[1] : null;
}

function titleFromSlug(slug: string): string {
  return slug
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function AddByUrl() {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const addWishlist = useAddWishlist();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const slug = slugFromUrl(value.trim());
    if (!slug) {
      setError('Paste a valid leetcode.com/problems/… URL');
      return;
    }
    setError('');
    addWishlist.mutate(
      { slug, url: value.trim(), title: titleFromSlug(slug) },
      { onSuccess: () => setValue('') }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 mb-6">
      <input
        type="text"
        value={value}
        onChange={e => { setValue(e.target.value); setError(''); }}
        placeholder="Paste a LeetCode problem URL…"
        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
      />
      <button
        type="submit"
        className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        <Plus size={15} />
        Add
      </button>
      {error && <p className="text-xs text-red-400 self-center">{error}</p>}
    </form>
  );
}
