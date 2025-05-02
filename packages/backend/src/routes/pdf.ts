import express from "express";
import axios from "axios";
import { logger } from "../utils/logger";

const router = express.Router();

// The URL to the PDF service
const PDF_SERVICE_URL = process.env.PDF_SERVICE_URL || "http://localhost:3001";

/**
 * Generate N4 form
 */
router.post("/generate-n4", async (req, res) => {
  try {
    const formData = req.body;
    
    logger.debug("POST /api/pdf/generate-n4 - Generating N4 form");
    console.log("POST /api/pdf/generate-n4 - Generating N4 form");
    
    // Validate required fields
    if (!formData.tenantName || !formData.landlordName || !formData.rentalAddress || !formData.rentAmount) {
      return res.status(400).json({
        error: "Missing required fields for N4 form"
      });
    }
    
    // Call the PDF service
    const response = await axios.post(`${PDF_SERVICE_URL}/pdf/n4`, formData, {
      responseType: "arraybuffer"
    });
    
    // Set headers for PDF download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="N4_${formData.tenantName}.pdf"`);
    
    // Send PDF data
    res.send(response.data);
  } catch (error) {
    logger.error("Error generating N4 form", error);
    console.log("Error generating N4 form", error);
    res.status(500).json({ error: "Failed to generate N4 form" });
  }
});

/**
 * Generate L1 form
 */
router.post("/generate-l1", async (req, res) => {
  try {
    const formData = req.body;
    
    logger.debug("POST /api/pdf/generate-l1 - Generating L1 form");
    console.log("POST /api/pdf/generate-l1 - Generating L1 form");
    
    // Validate required fields
    if (!formData.tenantName || !formData.landlordName || !formData.rentalAddress || !formData.rentAmount) {
      return res.status(400).json({
        error: "Missing required fields for L1 form"
      });
    }
    
    // Call the PDF service
    const response = await axios.post(`${PDF_SERVICE_URL}/pdf/l1`, formData, {
      responseType: "arraybuffer"
    });
    
    // Set headers for PDF download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="L1_${formData.tenantName}.pdf"`);
    
    // Send PDF data
    res.send(response.data);
  } catch (error) {
    logger.error("Error generating L1 form", error);
    console.log("Error generating L1 form", error);
    res.status(500).json({ error: "Failed to generate L1 form" });
  }
});

export default router;
