const express = require('express');
const reviewsClient = require('../clients/reviewsClient');
const { withCache, invalidate } = require('../services/cacheService');

const router = express.Router();

const REVIEWS_ALL_KEY = 'gw:reviews:all';
const reviewsByProductKey = (product) => `gw:reviews:product:${product}`;
const reviewByIdKey = (id) => `gw:reviews:${id}`;
const reviewByOrderKey = (orderId) => `gw:reviews:order:${orderId}`;
const avgByProductKey = (product) => `gw:reviews:avg:${product}`;

router.get('/reviews/status', async (req, res) => {
  const status = await reviewsClient.status();
  res.json(status);
});

router.get('/reviews/health', async (req, res) => {
  const health = await reviewsClient.health();
  res.json(health);
});

router.get('/reviews', async (req, res) => {
  if (req.query.product) {
    const data = await withCache(reviewsByProductKey(req.query.product), 30, () => reviewsClient.list(req.query.product));
    return res.json(data);
  }
  const data = await withCache(REVIEWS_ALL_KEY, 30, () => reviewsClient.list());
  return res.json(data);
});

router.get('/reviews/:id', async (req, res) => {
  const review = await withCache(reviewByIdKey(req.params.id), 30, () => reviewsClient.getById(req.params.id));
  if (review?.error === 'Review not found') return res.status(404).json(review);
  return res.json(review);
});

router.get('/reviews/order/:orderId', async (req, res) => {
  const review = await withCache(reviewByOrderKey(req.params.orderId), 30, () => reviewsClient.getByOrder(req.params.orderId));
  if (review?.error === 'Review not found') return res.status(404).json(review);
  return res.json(review);
});

router.get('/reviews/product/:product/average', async (req, res) => {
  const avg = await withCache(avgByProductKey(req.params.product), 30, () => reviewsClient.avgByProduct(req.params.product));
  res.json(avg);
});

router.post('/reviews', async (req, res) => {
  const created = await reviewsClient.create(req.body);
  if (created?.error === 'Review already exists for this order') {
    return res.status(409).json(created);
  }
  if (created?.error) {
    return res.status(500).json(created);
  }
  await invalidate([
    REVIEWS_ALL_KEY,
    reviewsByProductKey(req.body.product),
    reviewByOrderKey(req.body.orderId),
    reviewByIdKey(created.id),
    avgByProductKey(req.body.product),
  ]);
  return res.status(201).json(created);
});

router.put('/reviews/:id', async (req, res) => {
  const updated = await reviewsClient.update(req.params.id, req.body);
  if (updated?.error === 'Review not found') return res.status(404).json(updated);
  if (updated?.error) return res.status(500).json(updated);
  await invalidate([
    REVIEWS_ALL_KEY,
    reviewsByProductKey(updated.product),
    reviewByOrderKey(updated.orderId),
    reviewByIdKey(req.params.id),
    avgByProductKey(updated.product),
  ]);
  return res.json(updated);
});

router.delete('/reviews/:id', async (req, res) => {
  const removed = await reviewsClient.remove(req.params.id);
  if (removed?.error === 'Review not found') return res.status(404).json(removed);
  if (removed?.error) return res.status(500).json(removed);
  await invalidate([
    REVIEWS_ALL_KEY,
    reviewsByProductKey(removed.product),
    reviewByOrderKey(removed.orderId),
    reviewByIdKey(req.params.id),
    avgByProductKey(removed.product),
  ]);
  return res.json(removed);
});

module.exports = router;

