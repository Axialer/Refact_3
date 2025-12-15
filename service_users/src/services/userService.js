const { User, sequelize } = require('../models');
const { redisClient } = require('../config/redis');

const USERS_ALL_KEY = 'users:all';
const userByIdKey = (id) => `users:${id}`;

async function withCache(key, ttlSeconds, producer) {
  const cached = await redisClient.get(key);
  if (cached) {
    return JSON.parse(cached);
  }
  const value = await producer();
  await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
  return value;
}

async function invalidateCache(id) {
  const keys = [USERS_ALL_KEY];
  if (id) keys.push(userByIdKey(id));
  await Promise.all(keys.map((key) => redisClient.del(key)));
}

async function listUsers() {
  return withCache(USERS_ALL_KEY, 30, async () => User.findAll());
}

async function getUser(id) {
  return withCache(userByIdKey(id), 30, async () => User.findByPk(id));
}

async function createUser(payload) {
  const created = await sequelize.transaction(async (t) => User.create(payload, { transaction: t }));
  await invalidateCache(created.id);
  return created;
}

async function updateUser(id, payload) {
  const user = await User.findByPk(id);
  if (!user) return null;
  await user.update(payload);
  await invalidateCache(id);
  return user;
}

async function deleteUser(id) {
  const user = await User.findByPk(id);
  if (!user) return null;
  await user.destroy();
  await invalidateCache(id);
  return user;
}

module.exports = {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
};

