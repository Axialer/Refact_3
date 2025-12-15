const { Order, sequelize } = require('../models');
const { redisClient } = require('../config/redis');

const ORDERS_ALL_KEY = 'orders:all';
const ordersByUserKey = (userId) => `orders:user:${userId}`;
const orderByIdKey = (id) => `orders:${id}`;

async function withCache(key, ttlSeconds, producer) {
  const cached = await redisClient.get(key);
  if (cached) {
    return JSON.parse(cached);
  }
  const value = await producer();
  await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
  return value;
}

async function invalidateCache(id, userId) {
  const keys = [ORDERS_ALL_KEY];
  if (id) keys.push(orderByIdKey(id));
  if (userId) keys.push(ordersByUserKey(userId));
  await Promise.all(keys.map((key) => redisClient.del(key)));
}

async function listOrders(userId) {
  if (userId) {
    return withCache(ordersByUserKey(userId), 30, async () => Order.findAll({ where: { userId } }));
  }
  return withCache(ORDERS_ALL_KEY, 30, async () => Order.findAll());
}

async function getOrder(id) {
  return withCache(orderByIdKey(id), 30, async () => Order.findByPk(id));
}

async function createOrder(payload) {
  const created = await sequelize.transaction(async (t) => Order.create(payload, { transaction: t }));
  await invalidateCache(created.id, created.userId);
  return created;
}

async function updateOrder(id, payload) {
  const order = await Order.findByPk(id);
  if (!order) return null;
  await order.update(payload);
  await invalidateCache(id, order.userId);
  return order;
}

async function deleteOrder(id) {
  const order = await Order.findByPk(id);
  if (!order) return null;
  const userId = order.userId;
  await order.destroy();
  await invalidateCache(id, userId);
  return order;
}

module.exports = {
  listOrders,
  getOrder,
  createOrder,
  updateOrder,
  deleteOrder,
};

