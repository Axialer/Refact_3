const { createCircuit } = require('../lib/circuit');
const { reviewsUrl } = require('../config/services');

const circuit = createCircuit();

circuit.fallback(() => ({ error: 'Reviews service temporarily unavailable' }));

module.exports = {
  circuit,
  list: (product) => {
    const url = product ? `${reviewsUrl}/reviews?product=${encodeURIComponent(product)}` : `${reviewsUrl}/reviews`;
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

