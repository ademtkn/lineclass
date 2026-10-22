import "server-only";

// Basit, süreç içi sabit pencere sınırlayıcı. Tek sunuculu kurulum için yeterli;
// birden çok sunucuda (serverless) Redis/Upstash gibi paylaşılan bir depo kullanılmalı.
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}
