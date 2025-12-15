module.exports = {
  usersUrl: process.env.USERS_SERVICE_URL || 'http://service_users:8000',
  ordersUrl: process.env.ORDERS_SERVICE_URL || 'http://service_orders:8000',
  reviewsUrl: process.env.REVIEWS_SERVICE_URL || 'http://service_reviews:8000',
};

