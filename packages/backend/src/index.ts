import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import path from "path";
import { logger } from "./utils/logger";
import { errorHandler } from "./middleware/errorHandler";
import tenantsRoutes from "./routes/tenants";
import rentRoutes from "./routes/rent";
import whatsappRoutes from "./routes/whatsapp";
import cronRoutes from "./routes/cron";
import pdfRoutes from "./routes/pdf";
import aiToolsRoutes from "./routes/ai-tools";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));
app.use(express.json());
app.use(morgan("dev"));

// Routes
app.use("/api/tenants", tenantsRoutes);
app.use("/api/rent", rentRoutes);
app.use("/api/whatsapp", whatsappRoutes);
app.use("/api/pdf", pdfRoutes);
app.use("/api/ai-tools", aiToolsRoutes);
app.use("/api/cron", cronRoutes);

// Root route for health check with DB connection test
app.get("/", async (req, res) => {
  try {
    // Import supabase here to avoid circular dependencies
    const { supabase } = require("./config/database");

    // Test connection by querying a table
    const { data, error } = await supabase.from("tenants").select("*").limit(1);

    if (error) {
      console.log("Database connection test failed:", error);
      return res.json({
        status: "ok",
        message: "Rent Whisperer API is running",
        db_status: "error",
        db_error: JSON.stringify(error),
      });
    }

    return res.json({
      status: "ok",
      message: "Rent Whisperer API is running",
      db_status: "connected",
      tables_exist: data !== null ? "yes" : "unknown",
    });
  } catch (err) {
    console.log("Error in root route:", err);
    return res.json({
      status: "ok",
      message: "Rent Whisperer API is running",
      db_status: "exception",
      error: String(err),
    });
  }
});

// Error handling middleware
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  console.log(`Server running on port ${PORT}`);
});

export default app;
