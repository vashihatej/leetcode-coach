import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
export function useActivity() {
  return useQuery({ queryKey: ['activity'], queryFn: api.activity });
}
