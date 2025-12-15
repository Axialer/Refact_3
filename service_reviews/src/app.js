const express = require('express');
const cors = require('cors');
const reviewsRouter = require('./routes/reviews');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/reviews', reviewsRouter);

module.exports = app;

