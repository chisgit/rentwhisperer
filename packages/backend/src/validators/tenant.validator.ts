import Joi from "joi";

// Schema for creating a new tenant
export const createTenantSchema = Joi.object({
  first_name: Joi.string().required().trim().messages({
    'string.empty': 'First name is required',
    'any.required': 'First name is required'
  }),
  last_name: Joi.string().required().trim().messages({
    'string.empty': 'Last name is required',
    'any.required': 'Last name is required'
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'Please enter a valid email address',
    'any.required': 'Email is required'
  }),
  phone: Joi.string().required().trim().messages({
    'string.empty': 'Phone number is required',
    'any.required': 'Phone number is required'
  }),
  unit_id: Joi.string().uuid().required().messages({
    'string.guid': 'Invalid unit ID format',
    'any.required': 'Unit ID is required'
  }),
  // When unit_id is present, rent_amount and rent_due_day should be required
  rent_amount: Joi.when('unit_id', {
    is: Joi.exist(),
    then: Joi.number().min(0).required().messages({
      'number.base': 'Rent amount must be a number',
      'number.min': 'Rent amount cannot be negative',
      'any.required': 'Rent amount is required'
    }),
    otherwise: Joi.number().min(0).optional()
  }),
  rent_due_day: Joi.when('unit_id', {
    is: Joi.exist(),
    then: Joi.number().integer().min(1).max(31).required().messages({
      'number.base': 'Rent due day must be a number',
      'number.min': 'Rent due day must be between 1 and 31',
      'number.max': 'Rent due day must be between 1 and 31',
      'any.required': 'Rent due day is required'
    }),
    otherwise: Joi.number().integer().min(1).max(31).optional()
  })
}).unknown(false); // Don't allow unknown fields

// Schema for updating an existing tenant (all fields optional)
export const updateTenantSchema = Joi.object({
  first_name: Joi.string().trim().messages({
    'string.empty': 'First name cannot be empty'
  }),
  last_name: Joi.string().trim().messages({
    'string.empty': 'Last name cannot be empty'
  }),
  email: Joi.string().email().messages({
    'string.email': 'Please enter a valid email address'
  }),
  phone: Joi.string().trim().messages({
    'string.empty': 'Phone number cannot be empty'
  }),
  unit_id: Joi.string().uuid().messages({
    'string.guid': 'Invalid unit ID format'
  }),
  // Add conditional validation for update too
  rent_amount: Joi.when('unit_id', {
    is: Joi.exist(),
    then: Joi.number().min(0).required().messages({
      'number.base': 'Rent amount must be a number',
      'number.min': 'Rent amount cannot be negative',
      'any.required': 'Rent amount is required when updating unit'
    }),
    otherwise: Joi.number().min(0).allow(null).optional()
  }),
  rent_due_day: Joi.when('unit_id', {
    is: Joi.exist(),
    then: Joi.number().integer().min(1).max(31).required().messages({
      'number.base': 'Rent due day must be a number',
      'number.min': 'Rent due day must be between 1 and 31',
      'number.max': 'Rent due day must be between 1 and 31',
      'any.required': 'Rent due day is required when updating unit'
    }),
    otherwise: Joi.number().integer().min(1).max(31).allow(null).optional()
  })
}).unknown(false); // Don't allow unknown fields
