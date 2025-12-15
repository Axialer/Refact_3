const { sequelize } = require('../config/database');
const defineReview = require('./review');

const Review = defineReview(sequelize);

module.exports = {
  sequelize,
  Review,
};

