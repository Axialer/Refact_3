const { createCircuit } = require('../lib/circuit');
const { usersUrl } = require('../config/services');

const circuit = createCircuit();

circuit.fallback(() => ({ error: 'Users service temporarily unavailable' }));

module.exports = {
  circuit,
  list: () => circuit.fire(`${usersUrl}/users`),
  getById: (id) => circuit.fire(`${usersUrl}/users/${id}`),
  create: (payload) => circuit.fire(`${usersUrl}/users`, { method: 'POST', data: payload }),
  update: (id, payload) => circuit.fire(`${usersUrl}/users/${id}`, { method: 'PUT', data: payload }),
  remove: (id) => circuit.fire(`${usersUrl}/users/${id}`, { method: 'DELETE' }),
};

