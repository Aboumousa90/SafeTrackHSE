import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

const buckets = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

/**
 * Durable per-user AI rate limit. Uses the consume_ai_rate_limit RPC when
 * Supabase is configured (one shared counter across serverless instances);
 * falls back to an in-process counter in demo mode or when the RPC is
 * unavailable (e.g. migration 002 not applied yet).
 */
export async function checkAiRateLimit(userId: string, limit = 20, windowMs = 60 * 60 * 1000): Promise<RateLimitResult> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createSupabaseServerClient();
      const { data, error } = await supabase.rpc("consume_ai_rate_limit", {
        p_user_key: userId,
        p_limit: limit,
        p_window_seconds: Math.floor(windowMs / 1000),
      });

      if (!error && Array.isArray(data) && data.length > 0) {
        const row = data[0] as { allowed: boolean; remaining: number };
        return { allowed: row.allowed, remaining: row.remaining };
      }
    } catch {
      // Fall through to the in-process limiter below.
    }
  }

  return checkInProcessRateLimit(userId, limit, windowMs);
}

function checkInProcessRateLimit(userId: string, limit: number, windowMs: number): RateLimitResult {
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
