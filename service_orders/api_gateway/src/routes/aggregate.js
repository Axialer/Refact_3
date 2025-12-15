const express = require('express');
const usersClient = require('../clients/usersClient');
const ordersClient = require('../clients/ordersClient');
const { withCache } = require('../services/cacheService');

const router = express.Router();
const userDetailsKey = (id) => `gw:user-details:${id}`;

router.get('/users/:userId/details', async (req, res) => {
  const { userId } = req.params;
  const result = await withCache(userDetailsKey(userId), 30, async () => {
    const [user, orders] = await Promise.all([
      usersClient.getById(userId),
      ordersClient.list().then((list) => list.filter((o) => String(o.userId) === String(userId))),
    ]);
    if (user?.error === 'User not found') return user;
    return { user, orders };
  });

  if (result?.error === 'User not found') return res.status(404).json(result);
  return res.json(result);
});

module.exports = router;

