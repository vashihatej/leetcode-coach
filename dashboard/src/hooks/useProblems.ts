import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
export function useProblems() {
  return useQuery({ queryKey: ['problems'], queryFn: api.problems });
}
