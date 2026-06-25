import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useWishlist() {
  return useQuery({ queryKey: ['wishlist'], queryFn: api.wishlist });
}
export function useAddWishlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.addWishlist,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wishlist'] }),
  });
}
export function useUpdateWishlistNotes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, notes }: { slug: string; notes: string }) =>
      api.updateWishlistNotes(slug, notes),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wishlist'] }),
  });
}
export function useRemoveWishlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.removeWishlist,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wishlist'] }),
  });
}
