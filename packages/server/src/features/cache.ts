export interface TimedCache<T> {
  get(ttlMs: number, loader: () => Promise<T> | T): Promise<T>;
  clear(): void;
}

export function createTimedCache<T>(): TimedCache<T> {
  let value: T | undefined;
  let expiresAt = 0;

  return {
    async get(ttlMs: number, loader: () => Promise<T> | T): Promise<T> {
      const now = Date.now();
      if (value !== undefined && now < expiresAt) {
        return value;
      }

      const result = await loader();
      value = result;
      expiresAt = now + ttlMs;
      return result;
    },
    clear() {
      value = undefined;
      expiresAt = 0;
    },
  };
}

