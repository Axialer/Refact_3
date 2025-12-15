const express = require('express');
const cors = require('cors');
const ordersRouter = require('./routes/orders');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/orders', ordersRouter);

module.exports = app;

