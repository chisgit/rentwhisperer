import Joi from "joi";

// Schema for creating a new rent payment (usually done internally by cron)
export const createRentPaymentSchema = Joi.object({
  tenant_id: Joi.string().uuid().required(),
  unit_id: Joi.string().uuid().required(),
  amount: Joi.number().positive().required(),
  due_date: Joi.date().iso().required(),
  status: Joi.string().valid("pending", "paid", "late", "partial").default("pending"),
  payment_method: Joi.string().allow(null),
  interac_request_link: Joi.string().uri().allow(null),
});

// Schema for updating a rent payment (e.g., marking as paid)
export const updateRentPaymentSchema = Joi.object({
  status: Joi.string().valid("pending", "paid", "late", "partial"),
  payment_date: Joi.date().iso().allow(null),
  payment_method: Joi.string().allow(null),
  // You might not want to allow updating other fields like amount or due_date easily
});
