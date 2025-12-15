const { DataTypes, QueryTypes } = require('sequelize');
const { sequelize } = require('../models');

const MIGRATIONS_TABLE = '_migrations_reviews';

const migrations = [
  {
    name: '001-create-reviews',
    up: async (queryInterface) => {
      await queryInterface.createTable('Reviews', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        orderId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          unique: true,
        },
        userId: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        product: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        rating: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        comment: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
      });
    },
  },
];

async function ensureMigrationsTable(queryInterface) {
  try {
    await queryInterface.createTable(MIGRATIONS_TABLE, {
      name: { type: DataTypes.STRING, primaryKey: true },
      runOn: { type: DataTypes.DATE, allowNull: false },
    });
  } catch (error) {
    if (error.original?.code !== '42P07') {
      throw error;
    }
  }
}

async function getAppliedMigrations(queryInterface) {
  try {
    const rows = await queryInterface.sequelize.query(
      `SELECT name FROM "${MIGRATIONS_TABLE}"`,
      { type: QueryTypes.SELECT },
    );
    return rows.map((row) => row.name);
  } catch (error) {
    if (error.original?.code === '42P01') return [];
    throw error;
  }
}

async function setMigrationDone(queryInterface, name) {
  await queryInterface.sequelize.query(
    `INSERT INTO "${MIGRATIONS_TABLE}" (name, "runOn") VALUES (:name, NOW())`,
    { replacements: { name } },
  );
}

async function migrate() {
  const queryInterface = sequelize.getQueryInterface();
  await ensureMigrationsTable(queryInterface);
  const done = await getAppliedMigrations(queryInterface);
  const pending = migrations.filter((m) => !done.includes(m.name));

  for (const migration of pending) {
    console.log(`Running migration ${migration.name}`);
    await migration.up(queryInterface, sequelize);
    await setMigrationDone(queryInterface, migration.name);
  }
  console.log('Migrations complete');
}

if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed', err);
      process.exit(1);
    });
}

module.exports = migrate;

