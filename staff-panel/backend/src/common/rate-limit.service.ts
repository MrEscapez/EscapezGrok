import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

type Bucket = {
  /** Timestamps (ms) of hits inside the current window */
  hits: number[];
};

/**
 * In-memory sliding-window rate limiter (FASE 16 stub).
 * Fine for single-process demo; replace with Redis for multi-instance.
 */
@Injectable()
export class RateLimitService {
  private readonly buckets = new Map<string, Bucket>();

  /**
   * Record a hit for `key`. Throws 429 when `limit` is exceeded inside `windowMs`.
   */
  assertAllowed(
    key: string,
    limit: number,
    windowMs: number,
    message = 'Te veel verzoeken. Probeer later opnieuw.',
  ): void {
    const now = Date.now();
    const cutoff = now - windowMs;
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { hits: [] };
      this.buckets.set(key, bucket);
    }
    bucket.hits = bucket.hits.filter((t) => t > cutoff);
    if (bucket.hits.length >= limit) {
      throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
    }
    bucket.hits.push(now);
  }

  /** Clear a key (e.g. after successful login). */
  reset(key: string): void {
    this.buckets.delete(key);
  }

  /** Test helper — wipe all buckets. */
  clearAll(): void {
    this.buckets.clear();
  }
}
