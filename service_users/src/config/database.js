const { Sequelize } = require('sequelize');

const {
  DB_HOST = 'db_users',
  DB_PORT = 5432,
  DB_NAME = 'users_db',
  DB_USER = 'postgres',
  DB_PASSWORD = 'postgres',
} = process.env;

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: 'postgres',
  logging: false,
});

module.exports = { sequelize };

