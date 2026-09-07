import { useQuery } from '@tanstack/react-query';
import { ApiError, fetchMe } from '../lib/api';
import { can as canPerm } from '../lib/permissions';

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

/** Permission helper bound to current /auth/me permissions. */
export function useCan() {
  const me = useMeQuery();
  return (permission: string) => canPerm(me.data?.permissions, permission);
}
