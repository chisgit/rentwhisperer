import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import { logger } from "./utils/logger";
import { errorHandler } from "./middleware/errorHandler";
import tenantsRoutes from "./routes/tenants";
import rentRoutes from "./routes/rent";
import whatsappRoutes from "./routes/whatsapp";
import cronRoutes from "./routes/cron";
import pdfRoutes from "./routes/pdf";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Routes
app.use("/api/tenants", tenantsRoutes);
app.use("/api/rent", rentRoutes);
app.use("/api/whatsapp", whatsappRoutes);
app.use("/api/pdf", pdfRoutes);
app.use("/cron", cronRoutes);

// Root route for health check
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Rent Whisperer API is running" });
});

// Error handling middleware
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  console.log(`Server running on port ${PORT}`);
});

export default app;
