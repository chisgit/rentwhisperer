import Joi from "joi";

// Schema for creating a new tenant
export const createTenantSchema = Joi.object({
  first_name: Joi.string().required(),
  last_name: Joi.string().required(),
  email: Joi.string().email().required(),
  phone: Joi.string().required(), // Basic validation, consider more specific phone validation if needed
  unit_id: Joi.string().uuid().required(),
  rent_amount: Joi.number().min(0),
  rent_due_day: Joi.number().integer().min(1).max(31),
});

// Schema for updating an existing tenant (all fields optional)
export const updateTenantSchema = Joi.object({
  first_name: Joi.string(),
  last_name: Joi.string(),
  email: Joi.string().email(),
  phone: Joi.string(),
  unit_id: Joi.string().uuid(),
  rent_amount: Joi.number().min(0).allow(null),
  rent_due_day: Joi.number().integer().min(1).max(31).allow(null),
});
