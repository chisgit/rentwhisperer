import express from "express";
import { generateN4Form, generateL1Form } from "../services/pdfGenerator.service";
import { logger } from "../utils/logger";

const router = express.Router();

/**
 * Generate N4 form as PDF
 */
router.post("/n4", async (req, res) => {
  try {
    const formData = req.body;
    
    logger.debug("POST /pdf/n4 - Generating N4 form");
    console.log("POST /pdf/n4 - Generating N4 form for tenant:", formData.tenantName);
    
    // Validate required fields
    if (!formData.tenantName || !formData.landlordName || !formData.rentalAddress || !formData.rentAmount || !formData.rentDueDate) {
      return res.status(400).json({
        error: "Missing required fields for N4 form"
      });
    }
    
    // Generate PDF
    const pdfBuffer = await generateN4Form(formData);
    
    // Set headers for PDF download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="N4_${formData.tenantName}.pdf"`);
    
    // Send PDF data
    res.send(pdfBuffer);
  } catch (error) {
    logger.error("Error in N4 form generation endpoint", error);
    console.log("Error in N4 form generation endpoint", error);
    res.status(500).json({ error: "Failed to generate N4 form" });
  }
});

/**
 * Generate L1 form as PDF
 */
router.post("/l1", async (req, res) => {
  try {
    const formData = req.body;
    
    logger.debug("POST /pdf/l1 - Generating L1 form");
    console.log("POST /pdf/l1 - Generating L1 form for tenant:", formData.tenantName);
    
    // Validate required fields
    if (!formData.tenantName || !formData.landlordName || !formData.rentalAddress || !formData.rentAmount || !formData.rentDueDate) {
      return res.status(400).json({
        error: "Missing required fields for L1 form"
      });
    }
    
    // Set a default reason if not provided
    if (!formData.reasonForApplication) {
      formData.reasonForApplication = "Non-payment of rent";
    }
    
    // Generate PDF
    const pdfBuffer = await generateL1Form(formData);
    
    // Set headers for PDF download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="L1_${formData.tenantName}.pdf"`);
    
    // Send PDF data
    res.send(pdfBuffer);
  } catch (error) {
    logger.error("Error in L1 form generation endpoint", error);
    console.log("Error in L1 form generation endpoint", error);
    res.status(500).json({ error: "Failed to generate L1 form" });
  }
});

export default router;
