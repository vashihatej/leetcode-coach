import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
export function useReview() {
  return useQuery({ queryKey: ['review'], queryFn: api.reviewDue });
}
