import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { logger } from "../utils/logger";

export const validateRequest = (
  schema: Joi.ObjectSchema,
  property: "body" | "query" | "params" = "body"
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false, // Return all errors
      stripUnknown: true, // Remove unknown keys
    });

    if (error) {
      logger.warn("Validation error:", error.details);
      console.log("Validation error:", error.details);
      const errors = error.details.map((detail) => detail.message);
      return res.status(400).json({ error: true, message: "Validation failed", errors });
    }

    // Attach validated value to request object (optional, but can be useful)
    // req[property] = value; // Be careful with overwriting req.params

    next();
  };
};
