const express = require('express');
const ordersClient = require('../clients/ordersClient');
const { withCache, invalidate } = require('../services/cacheService');

const router = express.Router();
const ORDERS_ALL_KEY = 'gw:orders:all';
const ordersByUserKey = (userId) => `gw:orders:user:${userId}`;
const orderByIdKey = (id) => `gw:orders:${id}`;

router.get('/status', async (req, res) => {
  const status = await ordersClient.status();
  res.json(status);
});

router.get('/health', async (req, res) => {
  const health = await ordersClient.health();
  res.json(health);
});

router.get('/:orderId', async (req, res) => {
  const order = await withCache(orderByIdKey(req.params.orderId), 30, () => ordersClient.getById(req.params.orderId));
  if (order?.error === 'Order not found') return res.status(404).json(order);
  return res.json(order);
});

router.get('/', async (req, res) => {
  if (req.query.userId) {
    const orders = await withCache(ordersByUserKey(req.query.userId), 30, () => ordersClient.list()
      .then((list) => list.filter((o) => String(o.userId) === String(req.query.userId))));
    return res.json(orders);
  }
  const orders = await withCache(ORDERS_ALL_KEY, 30, () => ordersClient.list());
  return res.json(orders);
});

router.post('/', async (req, res) => {
  const created = await ordersClient.create(req.body);
  await invalidate([ORDERS_ALL_KEY, ordersByUserKey(req.body.userId)]);
  res.status(201).json(created);
});

router.put('/:orderId', async (req, res) => {
  const updated = await ordersClient.update(req.params.orderId, req.body);
  if (updated?.error === 'Order not found') return res.status(404).json(updated);
  await invalidate([ORDERS_ALL_KEY, orderByIdKey(req.params.orderId), ordersByUserKey(updated.userId)]);
  res.json(updated);
});

router.delete('/:orderId', async (req, res) => {
  const removed = await ordersClient.remove(req.params.orderId);
  await invalidate([ORDERS_ALL_KEY, orderByIdKey(req.params.orderId)]);
  res.json(removed);
});

module.exports = router;

