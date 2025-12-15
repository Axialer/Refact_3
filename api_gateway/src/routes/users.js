const express = require('express');
const usersClient = require('../clients/usersClient');
const { withCache, invalidate } = require('../services/cacheService');

const router = express.Router();
const USERS_ALL_KEY = 'gw:users:all';
const userByIdKey = (id) => `gw:users:${id}`;

router.get('/', async (req, res) => {
  const users = await withCache(USERS_ALL_KEY, 30, () => usersClient.list());
  res.json(users);
});

router.get('/:userId', async (req, res) => {
  const user = await withCache(userByIdKey(req.params.userId), 30, () => usersClient.getById(req.params.userId));
  if (user?.error === 'User not found') return res.status(404).json(user);
  return res.json(user);
});

router.post('/', async (req, res) => {
  const created = await usersClient.create(req.body);
  if (created?.error) {
    return res.status(500).json(created);
  }
  await invalidate([USERS_ALL_KEY]);
  res.status(201).json(created);
});

router.put('/:userId', async (req, res) => {
  const updated = await usersClient.update(req.params.userId, req.body);
  if (updated?.error === 'User not found') return res.status(404).json(updated);
  if (updated?.error) return res.status(500).json(updated);
  await invalidate([USERS_ALL_KEY, userByIdKey(req.params.userId)]);
  res.json(updated);
});

router.delete('/:userId', async (req, res) => {
  const removed = await usersClient.remove(req.params.userId);
  if (removed?.error) {
    return res.status(404).json(removed);
  }
  await invalidate([USERS_ALL_KEY, userByIdKey(req.params.userId)]);
  res.json(removed);
});

module.exports = router;

