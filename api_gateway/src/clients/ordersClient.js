const { createCircuit } = require('../lib/circuit');
const { ordersUrl } = require('../config/services');

const circuit = createCircuit();

circuit.fallback(() => ({ error: 'Orders service temporarily unavailable' }));

module.exports = {
  circuit,
  list: () => circuit.fire(`${ordersUrl}/orders`),
  getById: (id) => circuit.fire(`${ordersUrl}/orders/${id}`),
  create: (payload) => circuit.fire(`${ordersUrl}/orders`, { method: 'POST', data: payload }),
  update: (id, payload) => circuit.fire(`${ordersUrl}/orders/${id}`, { method: 'PUT', data: payload }),
  remove: (id) => circuit.fire(`${ordersUrl}/orders/${id}`, { method: 'DELETE' }),
  status: () => circuit.fire(`${ordersUrl}/orders/status`),
  health: () => circuit.fire(`${ordersUrl}/orders/health`),
};

