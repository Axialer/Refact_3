const { sequelize } = require('../config/database');
const defineOrder = require('./order');

const Order = defineOrder(sequelize);

module.exports = {
  sequelize,
  Order,
};

