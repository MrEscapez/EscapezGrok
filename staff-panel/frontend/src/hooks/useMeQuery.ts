import { useQuery } from '@tanstack/react-query';
import { ApiError, fetchMe } from '../lib/api';

export function useMeQuery() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchMe,
    retry: false,
    staleTime: 30_000,
  });
}

export function isUnauthenticated(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}
