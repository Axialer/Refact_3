const app = require('./app');
const { sequelize } = require('./config/database');
const { redisClient } = require('./config/redis');
const migrate = require('./database/migrate');

const PORT = process.env.PORT || 8000;

async function start() {
  try {
    await redisClient.connect();
    await sequelize.authenticate();
    await migrate();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Users service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start Users service', error);
    process.exit(1);
  }
}

start();

