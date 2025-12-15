const Joi = require('joi');

const reviewCreateSchema = Joi.object({
  orderId: Joi.number().integer().required(),
  userId: Joi.number().integer().required(),
  product: Joi.string().min(2).required(),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().allow('', null),
});

const reviewUpdateSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5),
  comment: Joi.string().allow('', null),
}).min(1);

module.exports = {
  reviewCreateSchema,
  reviewUpdateSchema,
};

