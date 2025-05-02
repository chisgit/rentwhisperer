import PDFDocument from "pdfkit";
import { logger } from "../utils/logger";

// Interfaces for form data
interface N4FormData {
  tenantName: string;
  landlordName: string;
  rentalAddress: string;
  rentAmount: number;
  rentDueDate: string;
  rentPeriod?: string;
  terminationDate?: string; // Default 14 days from now
}

interface L1FormData {
  tenantName: string;
  landlordName: string;
  rentalAddress: string;
  rentAmount: number;
  rentDueDate: string;
  rentPeriod?: string;
  reasonForApplication: string;
}

/**
 * Generate Ontario LTB Form N4 - Notice to End a Tenancy Early for Non-payment of Rent
 */
export const generateN4Form = (data: N4FormData): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    try {
      logger.debug("Generating N4 form");
      console.log("Generating N4 form for tenant:", data.tenantName);

      // Create a PDF document
      const doc = new PDFDocument({
        size: "letter", // 8.5" x 11"
        margin: 50,
      });

      // Buffer to store PDF data
      const buffers: Buffer[] = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Set default values
      const today = new Date();
      const terminationDate = data.terminationDate || 
        new Date(today.setDate(today.getDate() + 14)).toISOString().split("T")[0];
      const rentPeriod = data.rentPeriod || "monthly";

      // Format currency
      const formatter = new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD",
      });
      const formattedRentAmount = formatter.format(data.rentAmount);

      // Add the LTB logo/header (placeholder)
      doc.fontSize(16)
        .font("Helvetica-Bold")
        .text("Form N4", { align: "center" });
        
      doc.moveDown(0.5);
      
      doc.fontSize(14)
        .text("Notice to End a Tenancy Early for Non-payment of Rent", { align: "center" });
        
      doc.moveDown(1);

      // Add form info
      doc.fontSize(10)
        .font("Helvetica")
        .text("Landlord and Tenant Board", { align: "center" });
        
      doc.moveDown(0.5);
      doc.text("Ontario Ministry of Housing", { align: "center" });
      doc.moveDown(2);

      // Part 1: Tenant Information
      doc.fontSize(12)
        .font("Helvetica-Bold")
        .text("To:", { continued: true })
        .font("Helvetica")
        .text(` ${data.tenantName}`);
        
      doc.moveDown(0.5);
      doc.text(`Address of Rental Unit: ${data.rentalAddress}`);
      doc.moveDown(1.5);

      // Part 2: Notice Information
      doc.fontSize(12)
        .font("Helvetica-Bold")
        .text("This is a legal notice that could lead to you being evicted from your home.");
        
      doc.moveDown(1);
      doc.font("Helvetica")
        .text(`I am giving you this notice because I want to end your tenancy. I want you to move out of your rental unit by: ${terminationDate}.`);
        
      doc.moveDown(1.5);

      // Part 3: Reason for Notice
      doc.fontSize(12)
        .font("Helvetica-Bold")
        .text("Reason for this Notice:");
        
      doc.moveDown(0.5);
      doc.font("Helvetica")
        .text(`I am giving you this notice because you owe rent. The amount you owe is ${formattedRentAmount}.`);
        
      doc.moveDown(0.5);
      doc.text(`This amount includes rent up to: ${data.rentDueDate}`);
      doc.moveDown(1.5);

      // Part 4: Landlord Information
      doc.fontSize(12)
        .font("Helvetica-Bold")
        .text("From:");
        
      doc.moveDown(0.5);
      doc.font("Helvetica")
        .text(`Landlord's Name: ${data.landlordName}`);
        
      doc.moveDown(0.5);
      doc.text(`Date: ${new Date().toLocaleDateString("en-CA")}`);
      doc.moveDown(2);

      // Note about tenant rights
      doc.fontSize(10)
        .font("Helvetica-Oblique")
        .text("Note: This is a simplified version of Form N4 for demonstration purposes. In a real situation, you would need to use the official LTB form.");

      // Finalize the PDF
      doc.end();

      logger.debug("N4 form generated successfully");
      console.log("N4 form generated successfully");
    } catch (error) {
      logger.error("Error generating N4 form", error);
      console.log("Error generating N4 form", error);
      reject(error);
    }
  });
};

/**
 * Generate Ontario LTB Form L1 - Application to Evict a Tenant for Non-payment of Rent
 */
export const generateL1Form = (data: L1FormData): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    try {
      logger.debug("Generating L1 form");
      console.log("Generating L1 form for tenant:", data.tenantName);

      // Create a PDF document
      const doc = new PDFDocument({
        size: "letter", // 8.5" x 11"
        margin: 50,
      });

      // Buffer to store PDF data
      const buffers: Buffer[] = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Set default values
      const rentPeriod = data.rentPeriod || "monthly";

      // Format currency
      const formatter = new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD",
      });
      const formattedRentAmount = formatter.format(data.rentAmount);

      // Add the LTB logo/header (placeholder)
      doc.fontSize(16)
        .font("Helvetica-Bold")
        .text("Form L1", { align: "center" });
        
      doc.moveDown(0.5);
      
      doc.fontSize(14)
        .text("Application to Evict a Tenant for Non-payment of Rent and to Collect Rent the Tenant Owes", { align: "center" });
        
      doc.moveDown(1);

      // Add form info
      doc.fontSize(10)
        .font("Helvetica")
        .text("Landlord and Tenant Board", { align: "center" });
        
      doc.moveDown(0.5);
      doc.text("Ontario Ministry of Housing", { align: "center" });
      doc.moveDown(2);

      // Part 1: Tenant Information
      doc.fontSize(12)
        .font("Helvetica-Bold")
        .text("Tenant Information:");
        
      doc.moveDown(0.5);
      doc.font("Helvetica")
        .text(`Tenant's Name: ${data.tenantName}`);
        
      doc.moveDown(0.5);
      doc.text(`Rental Unit Address: ${data.rentalAddress}`);
      doc.moveDown(1.5);

      // Part 2: Landlord Information
      doc.fontSize(12)
        .font("Helvetica-Bold")
        .text("Landlord Information:");
        
      doc.moveDown(0.5);
      doc.font("Helvetica")
        .text(`Landlord's Name: ${data.landlordName}`);
      doc.moveDown(1.5);

      // Part 3: Reason for Application
      doc.fontSize(12)
        .font("Helvetica-Bold")
        .text("Reason for Application:");
        
      doc.moveDown(0.5);
      doc.font("Helvetica")
        .text("I am applying for an order to have the tenant evicted because the tenant has not paid the rent that the tenant owes.");
        
      doc.moveDown(0.5);
      doc.text(`The tenant owes: ${formattedRentAmount} in rent as of ${data.rentDueDate}.`);
        
      doc.moveDown(0.5);
      doc.text(`Reason: ${data.reasonForApplication || "Non-payment of rent"}`);
      doc.moveDown(1.5);

      // Part 4: Details of rent owed
      doc.fontSize(12)
        .font("Helvetica-Bold")
        .text("Rent Information:");
        
      doc.moveDown(0.5);
      doc.font("Helvetica")
        .text(`Current Rent: ${formattedRentAmount} ${rentPeriod}`);
        
      doc.moveDown(0.5);
      doc.text(`Rent Due Date: ${data.rentDueDate}`);
      doc.moveDown(2);

      // Declaration
      doc.fontSize(12)
        .font("Helvetica-Bold")
        .text("Declaration:");
        
      doc.moveDown(0.5);
      doc.font("Helvetica")
        .text("I hereby declare that the information provided in this application is true to the best of my knowledge and belief.");
        
      doc.moveDown(0.5);
      doc.text(`Date: ${new Date().toLocaleDateString("en-CA")}`);
      doc.moveDown(2);

      // Note about application
      doc.fontSize(10)
        .font("Helvetica-Oblique")
        .text("Note: This is a simplified version of Form L1 for demonstration purposes. In a real situation, you would need to use the official LTB form.");

      // Finalize the PDF
      doc.end();

      logger.debug("L1 form generated successfully");
      console.log("L1 form generated successfully");
    } catch (error) {
      logger.error("Error generating L1 form", error);
      console.log("Error generating L1 form", error);
      reject(error);
    }
  });
};
