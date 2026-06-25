import AddByUrl from '../components/wishlist/AddByUrl';
import WishlistGrid from '../components/wishlist/WishlistGrid';

export default function Wishlist() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Wishlist</h1>
        <p className="text-sm text-gray-400 mt-1">
          Problems you want to tackle. Notes save on blur.
        </p>
      </div>
      <AddByUrl />
      <WishlistGrid />
    </div>
  );
}
