const app = require('./app');
const { redisClient } = require('./config/redis');
const usersClient = require('./clients/usersClient');
const ordersClient = require('./clients/ordersClient');
const reviewsClient = require('./clients/reviewsClient');

const PORT = process.env.PORT || 8000;

async function start() {
  try {
    await redisClient.connect();

    app.listen(PORT, () => {
      console.log(`API Gateway running on port ${PORT}`);

      usersClient.circuit.on('open', () => console.log('Users circuit breaker opened'));
      usersClient.circuit.on('close', () => console.log('Users circuit breaker closed'));
      usersClient.circuit.on('halfOpen', () => console.log('Users circuit breaker half-open'));

      ordersClient.circuit.on('open', () => console.log('Orders circuit breaker opened'));
      ordersClient.circuit.on('close', () => console.log('Orders circuit breaker closed'));
      ordersClient.circuit.on('halfOpen', () => console.log('Orders circuit breaker half-open'));

      reviewsClient.circuit.on('open', () => console.log('Reviews circuit breaker opened'));
      reviewsClient.circuit.on('close', () => console.log('Reviews circuit breaker closed'));
      reviewsClient.circuit.on('halfOpen', () => console.log('Reviews circuit breaker half-open'));
    });
  } catch (error) {
    console.error('Failed to start API Gateway', error);
    process.exit(1);
  }
}

start();

