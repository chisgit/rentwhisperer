import express from "express";
import { updateNotificationStatus } from "../services/notification.service";
import { supabase } from "../config/database";
import { logger } from "../utils/logger";

const router = express.Router();

/**
 * Webhook handler for WhatsApp status updates
 */
router.post("/webhook", async (req, res) => {
  try {
    logger.debug("POST /api/whatsapp/webhook - Received WhatsApp webhook");
    console.log("POST /api/whatsapp/webhook - Received WhatsApp webhook");
    
    // Log the full webhook payload for debugging
    logger.debug("Webhook payload:", req.body);
    console.log("Webhook payload received");
    
    // Handle different types of WhatsApp webhook payloads
    const { object, entry } = req.body;
    
    // Verify it's a WhatsApp webhook
    if (object !== "whatsapp_business_account") {
      logger.debug("Not a WhatsApp webhook");
      console.log("Not a WhatsApp webhook");
      return res.sendStatus(400);
    }
    
    // Process each entry (usually just one)
    for (const entryItem of entry) {
      const { changes } = entryItem;
      
      for (const change of changes) {
        const { value } = change;
        
        // Check if this is a message status update
        if (value?.statuses) {
          for (const status of value.statuses) {
            await handleWhatsAppStatusUpdate(status);
          }
        } 
        
        // Check if this is a message received event
        if (value?.messages) {
          for (const message of value.messages) {
            await handleWhatsAppIncomingMessage(message);
          }
        }
      }
    }
    
    // Acknowledge receipt of the webhook
    res.sendStatus(200);
  } catch (error) {
    logger.error("Error processing WhatsApp webhook", error);
    console.log("Error processing WhatsApp webhook", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * Webhook verification endpoint for WhatsApp
 */
router.get("/webhook", (req, res) => {
  // Your verify token (this should be a secret token set up with Meta)
  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "rent-whisperer-verify-token";
  
  // Parse the query params
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  
  logger.debug("GET /api/whatsapp/webhook - Verification request");
  console.log("GET /api/whatsapp/webhook - Verification request");
  
  // Check if a token and mode is in the query string
  if (mode && token) {
    // Check the mode and token
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      // Respond with the challenge token from the request
      logger.debug("WEBHOOK_VERIFIED");
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      // Respond with '403 Forbidden' if verify tokens don't match
      res.sendStatus(403);
    }
  } else {
    // Missing query parameters
    res.sendStatus(400);
  }
});

/**
 * Handle WhatsApp message status updates
 */
async function handleWhatsAppStatusUpdate(status: any) {
  try {
    const { id, status: messageStatus, recipient_id } = status;
    
    logger.debug(`Handling WhatsApp status update: ${messageStatus} for message ${id}`);
    console.log(`Handling WhatsApp status update: ${messageStatus} for message ${id}`);
    
    // Find the notification with this message ID
    const { data: notification, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("message_id", id)
      .single();
    
    if (error) {
      logger.error("Error finding notification for status update", error);
      console.log("Error finding notification for status update", error);
      return;
    }
    
    if (!notification) {
      logger.debug(`No notification found for message ID ${id}`);
      console.log(`No notification found for message ID ${id}`);
      return;
    }
    
    // Map WhatsApp status to our notification status
    let notificationStatus: "pending" | "sent" | "delivered" | "read" | "failed";
    
    switch (messageStatus) {
      case "sent":
        notificationStatus = "sent";
        break;
      case "delivered":
        notificationStatus = "delivered";
        break;
      case "read":
        notificationStatus = "read";
        break;
      case "failed":
        notificationStatus = "failed";
        break;
      default:
        notificationStatus = "sent"; // Default to 'sent' for any other statuses
    }
    
    // Update the notification status
    await updateNotificationStatus(notification.id, notificationStatus);
    
    logger.debug(`Updated notification ${notification.id} status to ${notificationStatus}`);
    console.log(`Updated notification ${notification.id} status to ${notificationStatus}`);
  } catch (error) {
    logger.error("Error handling WhatsApp status update", error);
    console.log("Error handling WhatsApp status update", error);
  }
}

/**
 * Handle incoming WhatsApp messages
 */
async function handleWhatsAppIncomingMessage(message: any) {
  try {
    const { from, id, timestamp, text } = message;
    
    logger.debug(`Received WhatsApp message from ${from}`);
    console.log(`Received WhatsApp message from ${from}`);
    
    // Store incoming message for analysis
    await supabase.from("incoming_messages").insert({
      phone_number: from,
      message_id: id,
      message_text: text?.body,
      received_at: new Date(parseInt(timestamp) * 1000).toISOString(),
      processed: false
    });
    
    logger.debug("Stored incoming WhatsApp message");
    console.log("Stored incoming WhatsApp message");
    
    // Note: In a more complete implementation, we'd process the message
    // to determine if it's a payment confirmation or other type of response
  } catch (error) {
    logger.error("Error handling incoming WhatsApp message", error);
    console.log("Error handling incoming WhatsApp message", error);
  }
}

export default router;
