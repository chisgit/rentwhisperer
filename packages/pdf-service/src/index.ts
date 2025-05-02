import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { logger } from "./utils/logger";
import { errorHandler } from "./middleware/errorHandler";
import pdfRoutes from "./routes/pdf";

// Load environment variables
dotenv.config();

const app = express();
// Use port 3001 by default for the PDF service (fallback to 3002 if 3001 is in use)
// or override completely with environment variable
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/pdf", pdfRoutes);

// Root route for health check
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "PDF Service is running" });
});

// Error handling middleware
app.use(errorHandler);

// Start server with fallback logic if the primary port is in use
const startServer = (port: number) => {
  const server = app.listen(port)
    .on("listening", () => {
      logger.info(`PDF Service running on port ${port}`);
      console.log(`PDF Service running on port ${port}`); // Keep console log as per rules
    })
    .on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE" && port === 3001) {
        console.log(`Port ${port} is in use, attempting to use port 3002...`);
        logger.info(`Port ${port} is in use, attempting to use port 3002...`);
        server.close();
        startServer(3002);
      } else {
        logger.error(`Error starting server: ${err.message}`);
        console.log(`Error starting server: ${err.message}`);
      }
    });
};

startServer(parseInt(PORT.toString(), 10));

export default app;
