const { redisClient } = require('../config/redis');

async function withCache(key, ttlSeconds, producer) {
  const cached = await redisClient.get(key);
  if (cached) return JSON.parse(cached);
  const value = await producer();
  await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
  return value;
}

async function invalidate(keys) {
  await Promise.all(keys.map((k) => redisClient.del(k)));
}

module.exports = {
  withCache,
  invalidate,
};

