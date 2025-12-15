const express = require('express');
const { userCreateSchema, userUpdateSchema } = require('../schemas/userSchema');
const userService = require('../services/userService');

const router = express.Router();

router.get('/', async (req, res) => {
  const users = await userService.listUsers();
  res.json(users);
});

router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Users Service',
    timestamp: new Date().toISOString(),
  });
});

router.get('/status', (req, res) => {
  res.json({ status: 'Users service is running' });
});

router.get('/:userId', async (req, res) => {
  const user = await userService.getUser(req.params.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json(user);
});

router.post('/', async (req, res) => {
  const { error, value } = userCreateSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const created = await userService.createUser(value);
  return res.status(201).json(created);
});

router.put('/:userId', async (req, res) => {
  const { error, value } = userUpdateSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const updated = await userService.updateUser(req.params.userId, value);
  if (!updated) return res.status(404).json({ error: 'User not found' });
  return res.json(updated);
});

router.delete('/:userId', async (req, res) => {
  const deleted = await userService.deleteUser(req.params.userId);
  if (!deleted) return res.status(404).json({ error: 'User not found' });
  return res.json({ message: 'User deleted', deletedUser: deleted });
});

module.exports = router;

