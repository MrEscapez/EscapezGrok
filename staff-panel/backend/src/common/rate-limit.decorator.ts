import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rateLimitOptions';

export type RateLimitOptions = {
  /** Max hits inside the window */
  limit: number;
  /** Window length in ms */
  windowMs: number;
  /**
   * Key strategy:
   * - ip — client IP only
   * - ip+username — IP + login body.username (for /auth/login)
   */
  key?: 'ip' | 'ip+username';
  message?: string;
};

export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);
