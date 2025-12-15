const Joi = require('joi');

const orderCreateSchema = Joi.object({
  userId: Joi.number().integer().required(),
  product: Joi.string().min(2).required(),
  amount: Joi.number().positive().required(),
  status: Joi.string().valid('pending', 'paid', 'shipped', 'cancelled').default('pending'),
});

const orderUpdateSchema = Joi.object({
  product: Joi.string().min(2),
  amount: Joi.number().positive(),
  status: Joi.string().valid('pending', 'paid', 'shipped', 'cancelled'),
}).min(1);

module.exports = {
  orderCreateSchema,
  orderUpdateSchema,
};

