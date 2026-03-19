export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
}

export interface RateLimiter {
  isAllowed(ip: string): boolean;
  reset(): void;
}

interface RateLimiterBucket {
  count: number;
  windowStart: number;
}

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const buckets = new Map<string, RateLimiterBucket>();

  return {
    isAllowed(ip: string): boolean {
      const now = Date.now();
      const current = buckets.get(ip);

      if (!current || now - current.windowStart >= options.windowMs) {
        buckets.set(ip, { count: 1, windowStart: now });
        return true;
      }

      if (current.count >= options.maxRequests) {
        return false;
      }

      current.count += 1;
      buckets.set(ip, current);
      return true;
    },
    reset(): void {
      buckets.clear();
    },
  };
}
