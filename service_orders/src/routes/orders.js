const express = require('express');
const { orderCreateSchema, orderUpdateSchema } = require('../schemas/orderSchema');
const orderService = require('../services/orderService');

const router = express.Router();

router.get('/status', (req, res) => res.json({ status: 'Orders service is running' }));

router.get('/health', (req, res) => res.json({
  status: 'OK',
  service: 'Orders Service',
  timestamp: new Date().toISOString(),
}));

router.get('/:orderId', async (req, res) => {
  const order = await orderService.getOrder(req.params.orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  return res.json(order);
});

router.get('/', async (req, res) => {
  const orders = await orderService.listOrders(req.query.userId);
  res.json(orders);
});

router.post('/', async (req, res) => {
  const { error, value } = orderCreateSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const created = await orderService.createOrder(value);
  return res.status(201).json(created);
});

router.put('/:orderId', async (req, res) => {
  const { error, value } = orderUpdateSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const updated = await orderService.updateOrder(req.params.orderId, value);
  if (!updated) return res.status(404).json({ error: 'Order not found' });
  return res.json(updated);
});

router.delete('/:orderId', async (req, res) => {
  const deleted = await orderService.deleteOrder(req.params.orderId);
  if (!deleted) return res.status(404).json({ error: 'Order not found' });
  return res.json({ message: 'Order deleted', deletedOrder: deleted });
});

module.exports = router;

