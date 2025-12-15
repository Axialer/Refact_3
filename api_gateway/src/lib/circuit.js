const CircuitBreaker = require('opossum');
const axios = require('axios');

const circuitOptions = {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 3000,
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

