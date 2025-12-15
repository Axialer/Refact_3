const Joi = require('joi');

const userCreateSchema = Joi.object({
  name: Joi.string().min(2).required(),
  email: Joi.string().email().required(),
  role: Joi.string().optional(),
});

const userUpdateSchema = Joi.object({
  name: Joi.string().min(2),
  email: Joi.string().email(),
  role: Joi.string(),
}).min(1);

module.exports = {
  userCreateSchema,
  userUpdateSchema,
};

