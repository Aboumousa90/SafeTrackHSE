const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkAiRateLimit(userId: string, limit = 20, windowMs = 60 * 60 * 1000) {
  const now = Date.now();
  const current = buckets.get(userId);

  if (!current || current.resetAt < now) {
    buckets.set(userId, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  if (current.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  current.count += 1;
  return { allowed: true, remaining: limit - current.count };
}
