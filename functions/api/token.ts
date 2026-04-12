/**
 * Cloudflare Pages Function - /api/token
 *
 * Returns the Gemini API key after rate-limit checks.
 * The key is stored as a Cloudflare secret (GEMINI_API_KEY).
 *
 * Rate limits (75% of free tier ~250 RPD = 187 RPD):
 * - Global: 187 requests per day across all users
 * - Per IP: 10 requests per hour (prevents one user hogging the quota)
 */

interface Env {
  GEMINI_API_KEY: string;
  RATE_LIMIT: KVNamespace; // Cloudflare KV for rate tracking
}

const GLOBAL_DAILY_LIMIT = 187;  // 75% of ~250 RPD free tier
const PER_IP_HOURLY_LIMIT = 10;

function getDateKey(): string {
  return `global:${new Date().toISOString().slice(0, 10)}`;
}

function getIpHourKey(ip: string): string {
  const d = new Date();
  return `ip:${ip}:${d.toISOString().slice(0, 13)}`;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  // Check the key exists
  if (!env.GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Only allow requests from translate.garden (or localhost for dev)
  const origin = request.headers.get('Origin') || '';
  const referer = request.headers.get('Referer') || '';
  const allowed = ['translate.garden', 'translate-garden.pages.dev', 'localhost'];
  const isAllowed = allowed.some(d => origin.includes(d) || referer.includes(d));
  if (!isAllowed) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  // If KV is not bound, skip rate limiting (dev/fallback)
  if (env.RATE_LIMIT) {
    // Check global daily limit
    const dateKey = getDateKey();
    const globalCount = parseInt(await env.RATE_LIMIT.get(dateKey) || '0');
    if (globalCount >= GLOBAL_DAILY_LIMIT) {
      return new Response(JSON.stringify({
        error: 'Daily free tier limit reached. Try again tomorrow or add your own API key in Settings.',
        limit: GLOBAL_DAILY_LIMIT,
        reset: 'midnight UTC',
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check per-IP hourly limit
    const ipKey = getIpHourKey(ip);
    const ipCount = parseInt(await env.RATE_LIMIT.get(ipKey) || '0');
    if (ipCount >= PER_IP_HOURLY_LIMIT) {
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded. Try again in an hour or add your own API key in Settings.',
        limit: PER_IP_HOURLY_LIMIT,
        window: '1 hour',
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Increment both counters
    await env.RATE_LIMIT.put(dateKey, String(globalCount + 1), { expirationTtl: 86400 });
    await env.RATE_LIMIT.put(ipKey, String(ipCount + 1), { expirationTtl: 3600 });
  }

  return new Response(JSON.stringify({ token: env.GEMINI_API_KEY }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
};
