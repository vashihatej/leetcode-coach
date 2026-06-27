import { useState } from 'react';
import AddByUrl from '../components/wishlist/AddByUrl';
import WishlistGrid from '../components/wishlist/WishlistGrid';
import ListsTab from '../components/wishlist/ListsTab';

type Tab = 'wishlist' | 'lists';

export default function Wishlist() {
  const [tab, setTab] = useState<Tab>('wishlist');

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-white">Wishlist</h1>
        <p className="text-sm text-gray-400 mt-1">
          Problems you want to tackle. Notes save on blur.
        </p>
      </div>

      <div className="flex gap-0 mb-6 border-b border-gray-700">
        {(['wishlist', 'lists'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            {t === 'wishlist' ? 'All Problems' : 'Lists'}
          </button>
        ))}
      </div>

      {tab === 'wishlist' ? (
        <>
          <AddByUrl />
          <WishlistGrid />
        </>
      ) : (
        <ListsTab />
      )}
    </div>
  );
}
