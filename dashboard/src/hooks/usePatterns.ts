import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
export function usePatterns() {
  return useQuery({ queryKey: ['patterns'], queryFn: api.patterns });
}
export function usePatternProblems(name: string | null) {
  return useQuery({
    queryKey: ['pattern-problems', name],
    queryFn: () => api.patternProblems(name!),
    enabled: !!name,
  });
}
