import pino from "pino";
import dotenv from "dotenv";

dotenv.config();

const logLevel = process.env.LOG_LEVEL || "info";

export const logger = pino({
  level: logLevel,
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
    },
  },
});
