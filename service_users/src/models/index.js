const { sequelize } = require('../config/database');
const defineUser = require('./user');

const User = defineUser(sequelize);

module.exports = {
  sequelize,
  User,
};

