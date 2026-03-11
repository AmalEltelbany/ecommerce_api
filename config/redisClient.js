const { createClient } = require('redis');

const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
  password: process.env.REDIS_PASSWORD || undefined,
});

redisClient.on('error', (err) =>
  console.error('Redis Client Error:', err.message)
);
redisClient.on('connect', () => console.log('Redis connected'));
redisClient.on('reconnecting', () => console.log('Redis reconnecting...'));

// Connect once at startup — non-blocking, errors are caught via event
redisClient.connect().catch((err) =>
  console.error('Redis initial connection failed:', err.message)
);

module.exports = redisClient;
