const { createClient } = require('redis');

const {
  REDIS_HOST = 'redis',
  REDIS_PORT = 6379,
} = process.env;

const redisClient = createClient({
  url: `redis://${REDIS_HOST}:${REDIS_PORT}`,
});

redisClient.on('error', (err) => {
  console.error('Redis error', err);
});

module.exports = { redisClient };

