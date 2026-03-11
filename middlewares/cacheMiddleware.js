const redis = require('../config/redisClient');

/**
 * Cache-aside pattern middleware.
 * On cache HIT  → respond immediately from Redis (no DB call)
 * On cache MISS → fall through to the route handler, then cache the response
 *
 * Redis failures degrade gracefully — the app falls through to the DB
 * without crashing or returning an error to the client.
 *
 * @param {string} keyPrefix - e.g. 'products', 'categories'
 * @param {number} ttlSeconds - how long to cache (default 5 minutes)
 */
exports.cacheMiddleware = (keyPrefix, ttlSeconds = 300) =>
  async (req, res, next) => {
    // Build a deterministic cache key from the route prefix + query params
    // Include user role in key to prevent serving admin data to regular users
    const role = req.user?.role || 'public';
    const cacheKey = `${keyPrefix}:${role}:${JSON.stringify(req.query)}`;

    try {
      const cached = await redis.get(cacheKey);

      if (cached) {
        return res.status(200).json({
          ...JSON.parse(cached),
          source: 'cache',
        });
      }

      // Cache miss: intercept res.json to cache the response before sending
      const originalJson = res.json.bind(res);
      res.json = (body) => {
        // Fire-and-forget — never let caching delay or break the response
        redis
          .setEx(cacheKey, ttlSeconds, JSON.stringify(body))
          .catch((err) =>
            console.error('Redis cache write error:', err.message)
          );
        return originalJson(body);
      };

      next();
    } catch (err) {
      // Redis unavailable — degrade gracefully, log and continue to DB
      console.error('Redis cache read error:', err.message);
      next();
    }
  };

/**
 * Invalidate all cached entries for a given prefix.
 * Called on create/update/delete mutations to bust stale cache.
 *
 * @param {string} keyPrefix - must match the prefix used in cacheMiddleware
 */
exports.invalidateCache = (keyPrefix) => async (req, res, next) => {
  try {
    const keys = await redis.keys(`${keyPrefix}:*:*`);
    if (keys.length > 0) {
      await redis.del(keys);
    }
  } catch (err) {
    console.error('Cache invalidation error:', err.message);
  }
  next(); // never block the mutation if cache invalidation fails
};
