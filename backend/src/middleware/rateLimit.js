// Minimal in-memory fixed-window rate limiter. No external package needed (npm registry
// isn't reachable from this environment) — good enough to stop scripted OTP-guessing /
// login-brute-forcing / wallet-draining loops, which today have nothing slowing them down.
// Not distributed (per-process only) — fine for a single backend instance; if this ever
// runs behind multiple instances, swap in a shared store (Redis, etc.) keyed the same way.

function createRateLimiter({ windowMs, max, message }) {
  const hits = new Map(); // key -> { count, resetAt }

  // Periodically sweep expired entries so this map doesn't grow forever
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, Math.max(windowMs, 60000)).unref?.();

  return function rateLimit(req, res, next) {
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
    const key = `${req.baseUrl}${req.path}:${ip}`;
    const now = Date.now();

    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    if (entry.count > max) {
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        success: false,
        message: message || 'Too many requests, please try again shortly.'
      });
    }

    next();
  };
}

// Tight limiter for OTP/login endpoints: brute-forcing a 4-digit OTP (10,000 possibilities)
// or password-guessing needs to be slow, not scriptable.
const authLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20,
  message: 'Too many attempts. Please wait a few minutes and try again.'
});

// Looser limiter for money-moving endpoints (deposits, withdrawals, admin approvals) —
// scripted abuse should be slowed down here too, without getting in the way of normal use.
const moneyLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30,
  message: 'Too many requests on this endpoint. Please wait a few minutes and try again.'
});

module.exports = { createRateLimiter, authLimiter, moneyLimiter };
