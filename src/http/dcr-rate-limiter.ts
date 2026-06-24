import type { Redis } from '@upstash/redis';

/**
 * Redis-backed fixed-window rate limiter for Dynamic Client Registration (DCR).
 * Uses Redis INCR + EXPIRE for per-IP rate limiting.
 *
 * If Redis is not configured (null) or errors, behavior depends on `failClosed`:
 * - `failClosed === false` (default): rate limiting is skipped/allowed
 *   (fail-open) — appropriate for local dev where Redis is often absent.
 * - `failClosed === true`: requests are denied (fail-closed) — used in
 *   production so a Redis outage cannot silently disable rate limiting.
 */
export class DcrRateLimiter {
  constructor(
    private redis: Redis | null,
    private prefix: string,
    private maxRequests: number,
    private windowSeconds: number,
    private failClosed: boolean = false
  ) {}

  /**
   * Check if the given IP is within the rate limit.
   * Returns true if allowed, false if rate limited.
   * When Redis is unavailable or errors, returns `!failClosed`.
   */
  public async checkLimit(clientIp: string): Promise<boolean> {
    if (!this.redis) {
      // No Redis configured. Fail open in dev, fail closed (deny) in prod.
      if (this.failClosed) {
        console.warn('[DcrRateLimiter] Redis unavailable; failing closed (denying request)');
        return false;
      }
      return true;
    }

    const key = `${this.prefix}dcr:ratelimit:${clientIp}`;

    try {
      const current = await this.redis.incr(key);

      // Set expiration on first increment
      if (current === 1) {
        await this.redis.expire(key, this.windowSeconds);
      }

      return current <= this.maxRequests;
    } catch (err) {
      // On any Redis error, fail open in dev or fail closed (deny) in prod.
      if (this.failClosed) {
        console.error('[DcrRateLimiter] Redis error; failing closed (denying request):', {
          error: err instanceof Error ? err.message : String(err),
        });
        return false;
      }
      return true;
    }
  }
}

/**
 * Extract the client IP from request headers.
 * Prefer x-forwarded-for (first IP, behind proxy), fall back to x-real-ip.
 * On Vercel, x-forwarded-for is authoritative.
 */
export function extractClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can be a comma-separated list; take the first IP
    const firstIp = forwardedFor.split(',')[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to connection remote address (may not work behind proxy)
  return 'unknown';
}
