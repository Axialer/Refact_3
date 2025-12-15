const express = require('express');
const usersClient = require('../clients/usersClient');
const ordersClient = require('../clients/ordersClient');
const reviewsClient = require('../clients/reviewsClient');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({
    status: 'API Gateway is running',
    circuits: {
      users: {
        status: usersClient.circuit.status,
        stats: usersClient.circuit.stats,
      },
      orders: {
        status: ordersClient.circuit.status,
        stats: ordersClient.circuit.stats,
      },
      reviews: {
        status: reviewsClient.circuit.status,
        stats: reviewsClient.circuit.stats,
      },
    },
  });
});

router.get('/status', (req, res) => res.json({ status: 'API Gateway is running' }));

module.exports = router;

