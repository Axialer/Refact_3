const express = require('express');
const cors = require('cors');

const usersRouter = require('./routes/users');
const ordersRouter = require('./routes/orders');
const aggregateRouter = require('./routes/aggregate');
const healthRouter = require('./routes/health');
const reviewsRouter = require('./routes/reviews');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/users', usersRouter);
app.use('/orders', ordersRouter);
app.use('/', reviewsRouter);
app.use('/', aggregateRouter);
app.use('/', healthRouter);

module.exports = app;

