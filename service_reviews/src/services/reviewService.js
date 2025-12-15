const { Review, sequelize } = require('../models');
const { redisClient } = require('../config/redis');

const REVIEWS_ALL_KEY = 'reviews:all';
const reviewByIdKey = (id) => `reviews:${id}`;
const reviewByOrderKey = (orderId) => `reviews:order:${orderId}`;
const avgByProductKey = (product) => `reviews:avg:${product}`;

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

async function list(product) {
  if (product) {
    return withCache(`reviews:product:${product}`, 30, async () => Review.findAll({ where: { product } }));
  }
  return withCache(REVIEWS_ALL_KEY, 30, async () => Review.findAll());
}

async function getById(id) {
  return withCache(reviewByIdKey(id), 30, async () => Review.findByPk(id));
}

async function getByOrder(orderId) {
  return withCache(reviewByOrderKey(orderId), 30, async () => Review.findOne({ where: { orderId } }));
}

async function create(payload) {
  // проверяем, что на заказ уже нет отзыва
  const existing = await Review.findOne({ where: { orderId: payload.orderId } });
  if (existing) {
    return { error: 'Review already exists for this order' };
  }
  const created = await sequelize.transaction(async (t) => Review.create(payload, { transaction: t }));
  await invalidate([REVIEWS_ALL_KEY, reviewByOrderKey(created.orderId), reviewByIdKey(created.id), `reviews:product:${created.product}`, avgByProductKey(created.product)]);
  return created;
}

async function update(id, payload) {
  const review = await Review.findByPk(id);
  if (!review) return null;
  await review.update(payload);
  await invalidate([reviewByIdKey(id), reviewByOrderKey(review.orderId), REVIEWS_ALL_KEY, `reviews:product:${review.product}`, avgByProductKey(review.product)]);
  return review;
}

async function remove(id) {
  const review = await Review.findByPk(id);
  if (!review) return null;
  const product = review.product;
  const orderId = review.orderId;
  await review.destroy();
  await invalidate([reviewByIdKey(id), reviewByOrderKey(orderId), REVIEWS_ALL_KEY, `reviews:product:${product}`, avgByProductKey(product)]);
  return review;
}

async function averageByProduct(product) {
  return withCache(avgByProductKey(product), 30, async () => {
    const result = await Review.findAll({
      attributes: [
        'product',
        [sequelize.fn('AVG', sequelize.col('rating')), 'avgRating'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      where: { product },
      group: ['product'],
    });
    if (!result.length) return { product, avgRating: null, count: 0 };
    const row = result[0].get({ plain: true });
    return { product: row.product, avgRating: Number(row.avgRating), count: Number(row.count) };
  });
}

module.exports = {
  list,
  getById,
  getByOrder,
  create,
  update,
  remove,
  averageByProduct,
};

