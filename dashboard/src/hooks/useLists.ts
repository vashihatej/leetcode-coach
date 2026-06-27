import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useLists() {
  return useQuery({ queryKey: ['lists'], queryFn: api.lists });
}

export function useListProblems(id: number | null) {
  return useQuery({
    queryKey: ['list-problems', id],
    queryFn: () => api.listProblems(id!),
    enabled: id != null,
  });
}

export function useCreateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.createList(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lists'] }),
  });
}

export function useBulkAddToList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, text }: { id: number; text: string }) => api.bulkAddToList(id, text),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['list-problems', id] });
      qc.invalidateQueries({ queryKey: ['wishlist'] });
    },
  });
}

export function useDeleteList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteList(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lists'] }),
  });
}
