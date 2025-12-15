# Технический отчёт по рефакторингу: переход от монолита к микросервисам

## Введение

Данный отчёт описывает процесс рефакторинга кодовой базы из монолитной архитектуры в микросервисную. Анализ основан на сравнении исходного состояния (коммит `67f628b` — «Add_files») и финального состояния (коммит `f8475b2` — «Merge pull request #1»).

### Контекст изменений

- **Было:** Монолитное приложение с хранением данных в памяти (переменные-словари), единый файл `index.js` для каждого сервиса
- **Стало:** Набор независимых микросервисов со своими базами данных PostgreSQL, общим кэшем Redis, API Gateway как единой точкой входа
- **Новый сервис:** `service_reviews` для управления отзывами

---

## 1. Структура проекта: сравнительный анализ

### 1.1. Итоговая структура директорий (после рефакторинга)

```
microservices-project/
├── api_gateway/
│   ├── src/
│   │   ├── config/
│   │   │   ├── redis.js
│   │   │   └── services.js
│   │   ├── lib/circuit.js
│   │   ├── clients/
│   │   │   ├── usersClient.js
│   │   │   ├── ordersClient.js
│   │   │   └── reviewsClient.js
│   │   ├── routes/
│   │   │   ├── users.js
│   │   │   ├── orders.js
│   │   │   ├── reviews.js
│   │   │   ├── aggregate.js
│   │   │   └── health.js
│   │   ├── services/cacheService.js
│   │   ├── app.js
│   │   └── server.js
│   └── Dockerfile
├── service_users/
│   ├── src/
│   │   ├── config/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── database/
│   │   ├── app.js
│   │   └── server.js
│   └── Dockerfile
├── service_orders/
│   └── ... (аналогичная структура)
├── service_reviews/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js
│   │   │   └── redis.js
│   │   ├── models/
│   │   │   ├── index.js
│   │   │   └── review.js
│   │   ├── schemas/reviewSchema.js
│   │   ├── services/reviewService.js
│   │   ├── routes/reviews.js
│   │   ├── database/migrate.js
│   │   ├── app.js
│   │   └── server.js
│   └── Dockerfile
├── docker-compose.yml
└── postman_collection.json
```

### Сравнение с исходной структурой (commit_old: `67f628b`)

**Исходная структура (монолит):**
```
project_root/
├── api_gateway/
│   ├── index.js       # 255 строк — вся логика в одном файле
│   ├── Dockerfile
│   └── package.json
├── service_users/
│   ├── index.js       # 89 строк — модель + роуты + хранение в памяти
│   ├── Dockerfile
│   └── package.json
├── service_orders/
│   ├── index.js       # 95 строк — аналогично
│   ├── Dockerfile
│   └── package.json
└── docker-compose.yml # 27 строк — только сервисы без БД
```

**Ключевые изменения структуры:**

| Что исчезло | Что появилось |
|------------|---------------|
| Единые файлы `index.js` на сервис | Модульная структура `/src` с разделением на слои |
| Хранение в памяти (`let fakeUsersDb = {}`) | Интеграция с PostgreSQL через Sequelize |
| Простой docker-compose без БД | docker-compose с 7 сервисами (3 БД + Redis) |
| — | Новый сервис `service_reviews` |
| — | Слой кэширования через Redis |
| — | Клиенты с Circuit Breaker для каждого сервиса |

### Листинг: docker-compose.yml (финальная версия)

```yaml
services:
  api_gateway:
    build: api_gateway
    ports:
      - "8000:8000"
    environment:
      - NODE_ENV=production
      - USERS_SERVICE_URL=http://service_users:8000
      - ORDERS_SERVICE_URL=http://service_orders:8000
      - REVIEWS_SERVICE_URL=http://service_reviews:8000
      - REDIS_HOST=redis
    depends_on:
      - redis
      - service_users
      - service_orders
      - service_reviews
    networks:
      - app-network

  service_users:
    build: service_users
    environment:
      - NODE_ENV=production
      - DB_HOST=db_users
      - DB_PORT=5432
      - DB_NAME=users_db
      - DB_USER=postgres
      - DB_PASSWORD=postgres
      - REDIS_HOST=redis
    depends_on:
      - db_users
      - redis
    networks:
      - app-network

  service_reviews:
    build: service_reviews
    environment:
      - NODE_ENV=production
      - DB_HOST=db_reviews
      - DB_PORT=5432
      - DB_NAME=reviews_db
      - DB_USER=postgres
      - DB_PASSWORD=postgres
      - REDIS_HOST=redis
    depends_on:
      - db_reviews
      - redis
    networks:
      - app-network

  service_orders:
    build: service_orders
    environment:
      - NODE_ENV=production
      - DB_HOST=db_orders
      - DB_PORT=5432
      - DB_NAME=orders_db
      - DB_USER=postgres
      - DB_PASSWORD=postgres
      - REDIS_HOST=redis
    depends_on:
      - db_orders
      - redis
    networks:
      - app-network

  db_users:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=users_db
    volumes:
      - pgdata_users:/var/lib/postgresql/data
    networks:
      - app-network

  db_orders:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=orders_db
    volumes:
      - pgdata_orders:/var/lib/postgresql/data
    networks:
      - app-network

  db_reviews:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=reviews_db
    volumes:
      - pgdata_reviews:/var/lib/postgresql/data
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    networks:
      - app-network

networks:
  app-network:
    driver: bridge

volumes:
  pgdata_users:
  pgdata_orders:
  pgdata_reviews:
```

**Изменения по сравнению с исходным docker-compose.yml (27 строк → 113 строк):**
- Добавлено 3 контейнера PostgreSQL с отдельными базами данных
- Добавлен контейнер Redis для кэширования
- Добавлен новый сервис `service_reviews`
- Добавлены переменные окружения для подключения к БД и Redis
- Добавлены volumes для персистентного хранения данных

---

### 1.2. Логика разделения кода на модули

После рефакторинга каждый микросервис следует слоистой архитектуре (Layered Architecture):

```
┌─────────────────────────────────────────┐
│              routes/                     │  ← Обработка HTTP-запросов
├─────────────────────────────────────────┤
│              schemas/                    │  ← Валидация входных данных (Joi)
├─────────────────────────────────────────┤
│              services/                   │  ← Бизнес-логика + кэширование
├─────────────────────────────────────────┤
│              models/                     │  ← ORM-модели (Sequelize)
├─────────────────────────────────────────┤
│              config/                     │  ← Конфигурация БД и Redis
└─────────────────────────────────────────┘
```

### Листинг: service_reviews/src/app.js (финальная версия)

```javascript
const express = require('express');
const cors = require('cors');
const reviewsRouter = require('./routes/reviews');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/reviews', reviewsRouter);

module.exports = app;
```

**Сравнение с монолитом (service_users/index.js из commit_old):**

```javascript
// Исходный код монолита (89 строк в одном файле)
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8000;

// middleware
app.use(cors());
app.use(express.json());

// имитация базы данных в памяти (LocalStorage)
let fakeUsersDb = {};
let currentId = 1;

app.get('/users', (req, res) => {
    const users = Object.values(fakeUsersDb);
    res.json(users);
});

app.post('/users', (req, res) => {
    const userData = req.body;
    const userId = currentId++;
    const newUser = {
        id: userId,
        ...userData
    };
    fakeUsersDb[userId] = newUser;
    res.status(201).json(newUser);
});

// ... остальные обработчики в том же файле

// запуск сервера
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Users service running on port ${PORT}`);
});
```

**Ключевые отличия:**

| Монолит (до) | Микросервис (после) |
|--------------|---------------------|
| Всё в одном файле | Разделение на модули: routes, services, models |
| Хранение в `fakeUsersDb = {}` | ORM Sequelize + PostgreSQL |
| Нет валидации | Joi-схемы в отдельных файлах |
| Нет кэширования | Redis-кэш в сервис-слое |
| Нет миграций | Программные миграции БД |

---

## 2. Реализация дополнительного сервиса (service_reviews)

### 2.1. Назначение и основные файлы

**Назначение:** Сервис отзывов позволяет пользователям оставлять отзывы к заказам с рейтингом (1-5 звезд).

**Основные функции:**
- Создание отзыва с привязкой к заказу (один отзыв на заказ)
- Получение отзывов по ID, по заказу, по продукту
- Расчёт средней оценки товара
- Обновление и удаление отзывов

**Связь с API Gateway:**

```
[Клиент] 
    ↓
[API Gateway :8000] ─── reviewsClient.js ─→ [service_reviews :8000]
    │                    (Circuit Breaker)        │
    ↓                                             ↓
[Redis] ← кэш ←───────────────────────────── [PostgreSQL]
```

### Листинг: api_gateway/src/clients/reviewsClient.js

```javascript
const { createCircuit } = require('../lib/circuit');
const { reviewsUrl } = require('../config/services');

const circuit = createCircuit();

circuit.fallback(() => ({ error: 'Reviews service temporarily unavailable' }));

module.exports = {
  circuit,
  list: (product) => {
    const url = product 
      ? `${reviewsUrl}/reviews?product=${encodeURIComponent(product)}` 
      : `${reviewsUrl}/reviews`;
    return circuit.fire(url);
  },
  getById: (id) => circuit.fire(`${reviewsUrl}/reviews/${id}`),
  getByOrder: (orderId) => circuit.fire(`${reviewsUrl}/reviews/order/${orderId}`),
  create: (payload) => circuit.fire(`${reviewsUrl}/reviews`, { method: 'POST', data: payload }),
  update: (id, payload) => circuit.fire(`${reviewsUrl}/reviews/${id}`, { method: 'PUT', data: payload }),
  remove: (id) => circuit.fire(`${reviewsUrl}/reviews/${id}`, { method: 'DELETE' }),
  avgByProduct: (product) => circuit.fire(`${reviewsUrl}/reviews/product/${encodeURIComponent(product)}/average`),
  health: () => circuit.fire(`${reviewsUrl}/reviews/health`),
  status: () => circuit.fire(`${reviewsUrl}/reviews/status`),
};
```

**Circuit Breaker (api_gateway/src/lib/circuit.js):**

```javascript
const CircuitBreaker = require('opossum');
const axios = require('axios');

const circuitOptions = {
  timeout: 3000,                  // таймаут запроса
  errorThresholdPercentage: 50,   // открытие при 50% ошибок
  resetTimeout: 3000,             // время до попытки восстановления
};

function createCircuit() {
  return new CircuitBreaker(async (url, options = {}) => {
    try {
      const response = await axios({
        url,
        ...options,
        validateStatus: (status) => (status >= 200 && status < 300) || status === 404,
      });
      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return error.response.data;
      }
      throw error;
    }
  }, circuitOptions);
}

module.exports = { createCircuit };
```

---

### 2.2. Примеры кода и бизнес-логика

#### Модель данных (service_reviews/src/models/review.js)

```javascript
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('Review', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  orderId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true, // один отзыв на заказ
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
    validate: {
      min: 1,
      max: 5,
    },
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'Reviews',
  timestamps: true,
});
```

**Особенности модели:**
- `orderId` с `unique: true` — один отзыв на заказ
- `rating` с валидацией диапазона 1-5
- Автоматические `createdAt` и `updatedAt` благодаря `timestamps: true`

#### Сервис-слой с кэшем (service_reviews/src/services/reviewService.js)

```javascript
const { Review, sequelize } = require('../models');
const { redisClient } = require('../config/redis');

const REVIEWS_ALL_KEY = 'reviews:all';
const reviewByIdKey = (id) => `reviews:${id}`;
const reviewByOrderKey = (orderId) => `reviews:order:${orderId}`;
const avgByProductKey = (product) => `reviews:avg:${product}`;

// Универсальная функция кэширования
async function withCache(key, ttlSeconds, producer) {
  const cached = await redisClient.get(key);
  if (cached) return JSON.parse(cached);
  const value = await producer();
  await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
  return value;
}

// Инвалидация кэша
async function invalidate(keys) {
  await Promise.all(keys.map((k) => redisClient.del(k)));
}

// Получение списка отзывов с кэшированием
async function list(product) {
  if (product) {
    return withCache(`reviews:product:${product}`, 30, async () => 
      Review.findAll({ where: { product } })
    );
  }
  return withCache(REVIEWS_ALL_KEY, 30, async () => Review.findAll());
}

// Получение отзыва по ID с кэшированием
async function getById(id) {
  return withCache(reviewByIdKey(id), 30, async () => Review.findByPk(id));
}

// Получение отзыва по заказу с кэшированием
async function getByOrder(orderId) {
  return withCache(reviewByOrderKey(orderId), 30, async () => 
    Review.findOne({ where: { orderId } })
  );
}

// Создание отзыва с проверкой уникальности и инвалидацией кэша
async function create(payload) {
  // проверяем, что на заказ уже нет отзыва
  const existing = await Review.findOne({ where: { orderId: payload.orderId } });
  if (existing) {
    return { error: 'Review already exists for this order' };
  }
  const created = await sequelize.transaction(async (t) => 
    Review.create(payload, { transaction: t })
  );
  await invalidate([
    REVIEWS_ALL_KEY, 
    reviewByOrderKey(created.orderId), 
    reviewByIdKey(created.id), 
    `reviews:product:${created.product}`, 
    avgByProductKey(created.product)
  ]);
  return created;
}

// Обновление отзыва с инвалидацией кэша
async function update(id, payload) {
  const review = await Review.findByPk(id);
  if (!review) return null;
  await review.update(payload);
  await invalidate([
    reviewByIdKey(id), 
    reviewByOrderKey(review.orderId), 
    REVIEWS_ALL_KEY, 
    `reviews:product:${review.product}`, 
    avgByProductKey(review.product)
  ]);
  return review;
}

// Удаление отзыва с инвалидацией кэша
async function remove(id) {
  const review = await Review.findByPk(id);
  if (!review) return null;
  const product = review.product;
  const orderId = review.orderId;
  await review.destroy();
  await invalidate([
    reviewByIdKey(id), 
    reviewByOrderKey(orderId), 
    REVIEWS_ALL_KEY, 
    `reviews:product:${product}`, 
    avgByProductKey(product)
  ]);
  return review;
}

// Расчёт средней оценки по товару
async function averageByProduct(product) {
  return withCache(avgByProductKey(product), 30, async () => {
    const result = await Review.findAll({
      attributes: [
        'product',
        [sequelize.fn('AVG', sequelize.col('rating')), 'avgRating'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      where: { product },
      group: ['product'],
    });
    if (!result.length) return { product, avgRating: null, count: 0 };
    const row = result[0].get({ plain: true });
    return { product: row.product, avgRating: Number(row.avgRating), count: Number(row.count) };
  });
}

module.exports = {
  list,
  getById,
  getByOrder,
  create,
  update,
  remove,
  averageByProduct,
};
```

#### Эндпоинты (service_reviews/src/routes/reviews.js)

```javascript
const express = require('express');
const { reviewCreateSchema, reviewUpdateSchema } = require('../schemas/reviewSchema');
const reviewService = require('../services/reviewService');

const router = express.Router();

// Health-check эндпоинты
router.get('/status', (req, res) => res.json({ status: 'Reviews service is running' }));
router.get('/health', (req, res) => res.json({
  status: 'OK',
  service: 'Reviews Service',
  timestamp: new Date().toISOString(),
}));

// Список отзывов (опционально по продукту)
router.get('/', async (req, res) => {
  const reviews = await reviewService.list(req.query.product);
  res.json(reviews);
});

// Получение отзыва по ID
router.get('/:id', async (req, res) => {
  const review = await reviewService.getById(req.params.id);
  if (!review) return res.status(404).json({ error: 'Review not found' });
  return res.json(review);
});

// Получение отзыва по заказу
router.get('/order/:orderId', async (req, res) => {
  const review = await reviewService.getByOrder(req.params.orderId);
  if (!review) return res.status(404).json({ error: 'Review not found' });
  return res.json(review);
});

// Средняя оценка по продукту
router.get('/product/:product/average', async (req, res) => {
  const avg = await reviewService.averageByProduct(req.params.product);
  res.json(avg);
});

// Создание отзыва
router.post('/', async (req, res) => {
  const { error, value } = reviewCreateSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const created = await reviewService.create(value);
  if (created?.error) return res.status(409).json(created);
  return res.status(201).json(created);
});

// Обновление отзыва
router.put('/:id', async (req, res) => {
  const { error, value } = reviewUpdateSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const updated = await reviewService.update(req.params.id, value);
  if (!updated) return res.status(404).json({ error: 'Review not found' });
  return res.json(updated);
});

// Удаление отзыва
router.delete('/:id', async (req, res) => {
  const removed = await reviewService.remove(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Review not found' });
  return res.json({ message: 'Review deleted', removed });
});

module.exports = router;
```

**Сравнение стиля обработчиков:**

| Монолит (до) | Микросервис (после) |
|--------------|---------------------|
| Логика в обработчике | Делегирование в сервис-слой |
| Прямое обращение к памяти | ORM + кэш |
| Нет валидации | Joi-схемы перед обработкой |
| Нет транзакций | Sequelize transactions |

---

## 3. Схема базы данных и миграции

### 3.1. Описание таблиц и связей

**До рефакторинга:** База данных отсутствовала. Данные хранились в памяти:
```javascript
let fakeUsersDb = {};  // service_users
let fakeOrdersDb = {};  // service_orders
```

**После рефакторинга:** Каждый сервис имеет изолированную БД PostgreSQL.

#### Таблица Users (db_users)

| Поле | Тип | Ограничения |
|------|-----|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT |
| name | STRING | NOT NULL |
| email | STRING | NOT NULL, UNIQUE |
| role | STRING | NULLABLE |
| createdAt | TIMESTAMP | NOT NULL |
| updatedAt | TIMESTAMP | NOT NULL |

#### Таблица Orders (db_orders)

| Поле | Тип | Ограничения |
|------|-----|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT |
| userId | INTEGER | NOT NULL (логическая связь с users) |
| product | STRING | NOT NULL |
| amount | DECIMAL(10,2) | NOT NULL |
| status | STRING | NOT NULL, DEFAULT 'pending' |
| createdAt | TIMESTAMP | NOT NULL |
| updatedAt | TIMESTAMP | NOT NULL |

#### Таблица Reviews (db_reviews)

| Поле | Тип | Ограничения |
|------|-----|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT |
| orderId | INTEGER | NOT NULL, UNIQUE (один отзыв на заказ) |
| userId | INTEGER | NOT NULL |
| product | STRING | NOT NULL |
| rating | INTEGER | NOT NULL, CHECK (1-5) |
| comment | TEXT | NULLABLE |
| createdAt | TIMESTAMP | NOT NULL |
| updatedAt | TIMESTAMP | NOT NULL |

**Логические связи:**
- `Reviews.orderId` → логическая связь с `Orders.id`
- `Reviews.userId` → логическая связь с `Users.id`
- `Orders.userId` → логическая связь с `Users.id`

> **Примечание:** В микросервисной архитектуре физические foreign key между базами разных сервисов невозможны. Целостность обеспечивается на уровне API Gateway и бизнес-логики.

### Листинг: Миграция для таблицы Reviews (service_reviews/src/database/migrate.js)

```javascript
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
    // PostgreSQL error codes: 42P07 = "таблица уже существует"
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
    // PostgreSQL error codes: 42P01 = "таблица не существует"
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

module.exports = migrate;
```

### 3.2. Механизм миграций

**Проблема монолита:** Данные хранились в памяти и терялись при перезапуске контейнера.

**Решение:** Программные миграции, выполняемые при старте сервиса.

**Запуск миграций (service_reviews/src/server.js):**

```javascript
const app = require('./app');
const { sequelize } = require('./config/database');
const { redisClient } = require('./config/redis');
const migrate = require('./database/migrate');

const PORT = process.env.PORT || 8000;

async function start() {
  try {
    await redisClient.connect();         // 1. Подключение к Redis
    await sequelize.authenticate();       // 2. Подключение к PostgreSQL
    await migrate();                      // 3. Выполнение миграций

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Reviews service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start Reviews service', error);
    process.exit(1);
  }
}

start();
```

**Особенности реализации миграций:**
- Таблица `_migrations_reviews` отслеживает выполненные миграции
- Идемпотентность: повторный запуск не приводит к ошибкам
- Каждый сервис имеет свою таблицу миграций (избежание конфликтов)

---

## 4. Кэширование эндпоинтов. Сравнение подходов

### 4.1. Перечень закэшированных эндпоинтов

#### API Gateway (уровень шлюза)

| Эндпоинт | Ключ Redis | TTL | Причина кэширования |
|----------|-----------|-----|---------------------|
| GET /users | gw:users:all | 30с | Частый запрос списка |
| GET /users/:id | gw:users:{id} | 30с | Частые запросы пользователя |
| GET /orders | gw:orders:all | 30с | Частый запрос списка |
| GET /orders/:id | gw:orders:{id} | 30с | Запросы по ID |
| GET /orders?userId= | gw:orders:user:{userId} | 30с | Фильтрация по пользователю |
| GET /reviews | gw:reviews:all | 30с | Частый запрос списка |
| GET /reviews/:id | gw:reviews:{id} | 30с | Запросы по ID |
| GET /reviews?product= | gw:reviews:product:{product} | 30с | Фильтрация по товару |
| GET /reviews/order/:orderId | gw:reviews:order:{orderId} | 30с | Запрос отзыва по заказу |
| GET /reviews/product/:product/average | gw:reviews:avg:{product} | 30с | Расчёт средней оценки |
| GET /users/:userId/details | gw:user-details:{userId} | 30с | Агрегированный запрос |

#### Сервисы (уровень микросервиса)

Аналогичное кэширование реализовано на уровне каждого микросервиса с префиксами:
- `users:*` — в service_users
- `orders:*` — в service_orders  
- `reviews:*` — в service_reviews

### Листинг: Кэширование на уровне API Gateway (api_gateway/src/services/cacheService.js)

```javascript
const { redisClient } = require('../config/redis');

async function withCache(key, ttlSeconds, producer) {
  const cached = await redisClient.get(key);
  if (cached) return JSON.parse(cached);
  const value = await producer();
  await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
  return value;
}

async function invalidate(keys) {
  await Promise.all(keys.map((k) => redisClient.del(k)));
}

module.exports = {
  withCache,
  invalidate,
};
```

**Использование в роутах (api_gateway/src/routes/reviews.js):**

```javascript
const { withCache, invalidate } = require('../services/cacheService');

const REVIEWS_ALL_KEY = 'gw:reviews:all';
const reviewByIdKey = (id) => `gw:reviews:${id}`;

// GET с кэшированием
router.get('/reviews', async (req, res) => {
  if (req.query.product) {
    const data = await withCache(
      reviewsByProductKey(req.query.product), 
      30, 
      () => reviewsClient.list(req.query.product)
    );
    return res.json(data);
  }
  const data = await withCache(REVIEWS_ALL_KEY, 30, () => reviewsClient.list());
  return res.json(data);
});
```

### Сравнение с монолитом (commit_old)

**Монолит (api_gateway/index.js из commit_old):**

```javascript
// Без кэширования — каждый запрос идёт в сервис
app.get('/users/:userId', async (req, res) => {
    try {
        const user = await usersCircuit.fire(`${USERS_SERVICE_URL}/users/${req.params.userId}`);
        if (user.error === 'User not found') {
            res.status(404).json(user);
        } else {
            res.json(user);
        }
    } catch (error) {
        res.status(500).json({error: 'Internal server error'});
    }
});
```

**Микросервисная архитектура (после рефакторинга):**

```javascript
// С кэшированием
router.get('/:userId', async (req, res) => {
  const user = await withCache(
    userByIdKey(req.params.userId), 
    30, 
    () => usersClient.getById(req.params.userId)
  );
  if (user?.error === 'User not found') return res.status(404).json(user);
  return res.json(user);
});
```

**Преимущества кэширования:**
- Снижение нагрузки на микросервисы и БД
- Уменьшение латентности повторных запросов
- Защита от пиковых нагрузок

---

### 4.2. Стратегия инвалидации кэша

**Принцип:** При любой модификации данных (CREATE, UPDATE, DELETE) связанные ключи кэша удаляются.

### Листинг: Инвалидация при обновлении отзыва (service_reviews/src/services/reviewService.js)

```javascript
async function update(id, payload) {
  const review = await Review.findByPk(id);
  if (!review) return null;
  
  await review.update(payload);
  
  // Инвалидация всех связанных ключей
  await invalidate([
    reviewByIdKey(id),                    // reviews:1
    reviewByOrderKey(review.orderId),     // reviews:order:5
    REVIEWS_ALL_KEY,                      // reviews:all
    `reviews:product:${review.product}`,  // reviews:product:Book
    avgByProductKey(review.product)       // reviews:avg:Book
  ]);
  
  return review;
}

async function remove(id) {
  const review = await Review.findByPk(id);
  if (!review) return null;
  
  const product = review.product;
  const orderId = review.orderId;
  
  await review.destroy();
  
  // Инвалидация после удаления
  await invalidate([
    reviewByIdKey(id),
    reviewByOrderKey(orderId),
    REVIEWS_ALL_KEY,
    `reviews:product:${product}`,
    avgByProductKey(product)
  ]);
  
  return review;
}
```

**На уровне API Gateway (api_gateway/src/routes/reviews.js):**

```javascript
router.put('/reviews/:id', async (req, res) => {
  const updated = await reviewsClient.update(req.params.id, req.body);
  if (updated?.error === 'Review not found') return res.status(404).json(updated);
  if (updated?.error) return res.status(500).json(updated);
  
  // Инвалидация кэша шлюза после успешного обновления
  await invalidate([
    REVIEWS_ALL_KEY,
    reviewsByProductKey(updated.product),
    reviewByOrderKey(updated.orderId),
    reviewByIdKey(req.params.id),
    avgByProductKey(updated.product),
  ]);
  
  return res.json(updated);
});
```

---

## 5. Интеграционное тестирование (Postman)

### 5.1. Структура коллекции

Рекомендуемая структура коллекции Postman для тестирования:

```
Microservices Refactoring
├── Health Checks
│   ├── GET /status
│   ├── GET /health
│   ├── GET /reviews/status
│   └── GET /reviews/health
├── Users
│   ├── POST /users (Create User)
│   ├── GET /users (List Users)
│   ├── GET /users/:id (Get User)
│   ├── PUT /users/:id (Update User)
│   └── DELETE /users/:id (Delete User)
├── Orders
│   ├── POST /orders (Create Order)
│   ├── GET /orders (List Orders)
│   ├── GET /orders/:id (Get Order)
│   ├── GET /orders?userId= (Filter by User)
│   ├── PUT /orders/:id (Update Order)
│   └── DELETE /orders/:id (Delete Order)
├── Reviews
│   ├── POST /reviews (Create Review)
│   ├── GET /reviews (List Reviews)
│   ├── GET /reviews/:id (Get Review)
│   ├── GET /reviews/order/:orderId (Get by Order)
│   ├── GET /reviews?product= (Filter by Product)
│   ├── GET /reviews/product/:product/average (Average Rating)
│   ├── PUT /reviews/:id (Update Review)
│   └── DELETE /reviews/:id (Delete Review)
└── Aggregation
    └── GET /users/:userId/details (User with Orders)
```

### 5.2. Примеры тестов

**Тест создания отзыва:**

```javascript
// POST /reviews
pm.test("Status code is 201", function () {
    pm.response.to.have.status(201);
});

pm.test("Response has required fields", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('id');
    pm.expect(jsonData).to.have.property('orderId');
    pm.expect(jsonData).to.have.property('userId');
    pm.expect(jsonData).to.have.property('product');
    pm.expect(jsonData).to.have.property('rating');
});

pm.test("Rating is within valid range", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.rating).to.be.within(1, 5);
});
```

**Тест получения средней оценки:**

```javascript
// GET /reviews/product/:product/average
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Response has average rating", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('product');
    pm.expect(jsonData).to.have.property('avgRating');
    pm.expect(jsonData).to.have.property('count');
});
```

**Тест уникальности отзыва на заказ:**

```javascript
// POST /reviews (duplicate)
pm.test("Status code is 409 for duplicate", function () {
    pm.response.to.have.status(409);
});

pm.test("Error message for existing review", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.error).to.eql("Review already exists for this order");
});
```

### 5.3. Корректность работы

**Проверяемые сценарии:**

1. **CRUD операции:** Создание, чтение, обновление, удаление для всех сущностей
2. **Валидация:** Отклонение невалидных данных (rating > 5, пустые поля)
3. **Бизнес-правила:** Один отзыв на заказ, расчёт средней оценки
4. **Circuit Breaker:** Fallback при недоступности сервиса
5. **Кэширование:** Повторные запросы быстрее первых

---

## 6. Архитектурные изменения, проблемы и решения

### 6.1. Ключевые изменения (сравнение commit_old vs commit_new)

| Аспект | До (commit_old) | После (commit_new) |
|--------|-----------------|---------------------|
| **Хранение данных** | В памяти (переменные) | PostgreSQL (изолированные БД) |
| **Персистентность** | Нет (теряется при перезапуске) | Да (volumes в Docker) |
| **Структура кода** | Монолит (1 файл на сервис) | Слоистая архитектура |
| **Кэширование** | Отсутствует | Redis на всех уровнях |
| **Количество сервисов** | 3 (gateway + 2) | 4 (gateway + 3) |
| **Контейнеры** | 3 | 8 (+ 3 БД + Redis) |
| **Валидация** | Отсутствует | Joi-схемы |
| **Миграции** | Нет | Программные миграции |
| **Транзакции** | Нет | Sequelize transactions |

### 6.2. Выявленные проблемы и пути их решения

#### Проблема 1: Потеря данных при перезапуске

**Симптом:** В монолите данные хранились в памяти (`let fakeUsersDb = {}`), что приводило к их потере.

**Решение:** 
- Интеграция с PostgreSQL через Sequelize
- Docker volumes для персистентности
- Миграции для создания схем

#### Проблема 2: Отсутствие изоляции данных

**Симптом:** В монолите все данные были в одном процессе.

**Решение:**
- Отдельная БД для каждого микросервиса (`db_users`, `db_orders`, `db_reviews`)
- Изолированные схемы и миграции

#### Проблема 3: Нагрузка на сервисы при частых запросах

**Симптом:** Каждый запрос проходил полный цикл обработки.

**Решение:**
- Двухуровневое кэширование (API Gateway + микросервисы)
- TTL 30 секунд для баланса актуальности и производительности
- Явная инвалидация при модификации

#### Проблема 4: Каскадные отказы при недоступности сервиса

**Симптом:** Падение одного сервиса могло заблокировать другие.

**Решение:**
- Circuit Breaker с таймаутом 3 секунды
- Fallback-ответы при недоступности сервиса
- Мониторинг состояния через /health эндпоинт

#### Проблема 5: Отсутствие валидации входных данных

**Симптом:** Невалидные данные могли попасть в хранилище.

**Решение:**
- Joi-схемы для валидации на уровне роутов
- Sequelize-валидаторы в моделях
- Проверки бизнес-правил в сервис-слое

---

## Резюме

### Архитектурные преимущества

1. **Масштабируемость:** Каждый сервис может масштабироваться независимо
2. **Независимость разработки:** Команды могут работать над разными сервисами параллельно
3. **Отказоустойчивость:** Circuit Breaker предотвращает каскадные отказы
4. **Производительность:** Кэширование снижает нагрузку на БД
5. **Персистентность:** Данные сохраняются между перезапусками
6. **Изоляция данных:** Каждый сервис владеет своими данными

### Компромиссы

1. **Сложность:** 8 контейнеров вместо 3, больше конфигурации
2. **Сетевые задержки:** Межсервисное взаимодействие добавляет латентность
3. **Мониторинг:** Требуется отслеживание здоровья всех сервисов
4. **Консистентность данных:** Отсутствие физических FK между сервисами
5. **Инвалидация кэша:** Необходимость явного управления кэшем

### Ссылки на изменения в коде

- **Структура проекта:** Сравнение структуры директорий (Раздел 1.1)
- **Слоистая архитектура:** `service_reviews/src/app.js` vs старый `index.js` (Раздел 1.2)
- **Circuit Breaker:** `api_gateway/src/clients/reviewsClient.js` (Раздел 2.1)
- **ORM модель:** `service_reviews/src/models/review.js` (Раздел 2.2)
- **Кэширование:** `service_reviews/src/services/reviewService.js` (Раздел 2.2)
- **Миграции:** `service_reviews/src/database/migrate.js` (Раздел 3.2)
- **Инвалидация кэша:** методы `update()` и `remove()` в reviewService (Раздел 4.2)
- **docker-compose:** Сравнение 27 → 113 строк (Раздел 1.1)

---

*Отчёт подготовлен на основе анализа коммитов `67f628b` (исходное состояние) и `f8475b2` (финальное состояние) репозитория Axialer/Refact_3.*
