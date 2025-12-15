const express = require('express');
const { reviewCreateSchema, reviewUpdateSchema } = require('../schemas/reviewSchema');
const reviewService = require('../services/reviewService');

const router = express.Router();

router.get('/status', (req, res) => res.json({ status: 'Reviews service is running' }));
router.get('/health', (req, res) => res.json({
  status: 'OK',
  service: 'Reviews Service',
  timestamp: new Date().toISOString(),
}));

router.get('/', async (req, res) => {
  const reviews = await reviewService.list(req.query.product);
  res.json(reviews);
});

router.get('/:id', async (req, res) => {
  const review = await reviewService.getById(req.params.id);
  if (!review) return res.status(404).json({ error: 'Review not found' });
  return res.json(review);
});

router.get('/order/:orderId', async (req, res) => {
  const review = await reviewService.getByOrder(req.params.orderId);
  if (!review) return res.status(404).json({ error: 'Review not found' });
  return res.json(review);
});

router.get('/product/:product/average', async (req, res) => {
  const avg = await reviewService.averageByProduct(req.params.product);
  res.json(avg);
});

router.post('/', async (req, res) => {
  const { error, value } = reviewCreateSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const created = await reviewService.create(value);
  if (created?.error) return res.status(409).json(created);
  return res.status(201).json(created);
});

router.put('/:id', async (req, res) => {
  const { error, value } = reviewUpdateSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const updated = await reviewService.update(req.params.id, value);
  if (!updated) return res.status(404).json({ error: 'Review not found' });
  return res.json(updated);
});

router.delete('/:id', async (req, res) => {
  const removed = await reviewService.remove(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Review not found' });
  return res.json({ message: 'Review deleted', removed });
});

module.exports = router;

