import { useWishlist } from '../../hooks/useWishlist';
import WishlistCard from './WishlistCard';

export default function WishlistGrid() {
  const { data: items = [], isLoading } = useWishlist();

  if (isLoading) return <p className="text-gray-400 text-sm">Loading wishlist…</p>;

  if (items.length === 0) {
    return (
      <p className="text-sm text-gray-500 bg-gray-800/40 rounded-xl px-5 py-6 text-center">
        Your wishlist is empty. Paste a LeetCode URL above or use the "+" button on the Problems page.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {items.map(item => (
        <WishlistCard key={item.id} item={item} />
      ))}
    </div>
  );
}
