import axios from "axios";
import dotenv from "dotenv";
import { logger } from "../utils/logger";

dotenv.config();

const WHATSAPP_API_VERSION = "v18.0";
const META_APP_ID = process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;
const WHATSAPP_BUSINESS_ACCOUNT_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

// Base URL for Meta WhatsApp Cloud API
const BASE_URL = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}`;

interface WhatsAppTemplateMessage {
  to: string;
  template: {
    name: string;
    language: {
      code: string;
    };
    components: Array<{
      type: "header" | "body" | "button";
      parameters: Array<{
        type: "text" | "currency" | "date_time" | "image" | "document" | "video";
        text?: string;
        currency?: {
          fallback_value: string;
          code: string;
          amount_1000: number;
        };
        date_time?: {
          fallback_value: string;
        };
      }>;
    }>;
  };
}

/**
 * Send a WhatsApp template message for rent notification
 */
export const sendRentDueMessage = async (
  phoneNumber: string,
  tenantName: string,
  dueDate: string,
  amount: number,
  unitAddress: string,
  interacLink: string
): Promise<string> => {
  try {
    logger.debug("Sending rent due WhatsApp message");
    console.log("Sending rent due WhatsApp message to", phoneNumber);

    // Format the phone number to ensure it has the correct format
    const formattedPhone = phoneNumber.startsWith("+") ? phoneNumber : `+${phoneNumber}`;

    // Format the currency amount
    const amountInCents = Math.round(amount * 1000);

    // Create the message payload
    const messagePayload: WhatsAppTemplateMessage = {
      to: formattedPhone,
      template: {
        name: "rent_due_notification",
        language: {
          code: "en_US"
        },
        components: [
          {
            type: "body",
            parameters: [
              {
                type: "text",
                text: tenantName
              },
              {
                type: "currency",
                currency: {
                  fallback_value: `$${amount.toFixed(2)}`,
                  code: "CAD",
                  amount_1000: amountInCents
                }
              },
              {
                type: "date_time",
                date_time: {
                  fallback_value: dueDate
                }
              },
              {
                type: "text",
                text: unitAddress
              },
              {
                type: "text",
                text: interacLink
              }
            ]
          }
        ]
      }
    };

    // Make the API call to send the message
    const response = await axios.post(
      `${BASE_URL}/messages`,
      messagePayload,
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}`
        }
      }
    );

    logger.debug("WhatsApp message sent successfully");
    console.log("WhatsApp message sent successfully", response.data);

    // Return the message ID from the WhatsApp API
    return response.data.messages[0].id;
  } catch (error) {
    logger.error("Error sending WhatsApp message", error);
    console.log("Error sending WhatsApp message", error);
    throw new Error("Failed to send WhatsApp message");
  }
};

/**
 * Send a WhatsApp template message for late rent notification
 */
export const sendRentLateMessage = async (
  phoneNumber: string,
  tenantName: string,
  daysLate: number,
  amount: number,
  interacLink: string,
  n4Link?: string
): Promise<string> => {
  try {
    logger.debug("Sending rent late WhatsApp message");
    console.log("Sending rent late WhatsApp message to", phoneNumber);

    // Format the phone number to ensure it has the correct format
    const formattedPhone = phoneNumber.startsWith("+") ? phoneNumber : `+${phoneNumber}`;

    // Format the currency amount
    const amountInCents = Math.round(amount * 1000);

    // Create the message payload
    const messagePayload: WhatsAppTemplateMessage = {
      to: formattedPhone,
      template: {
        name: "rent_late_notification",
        language: {
          code: "en_US"
        },
        components: [
          {
            type: "body",
            parameters: [
              {
                type: "text",
                text: tenantName
              },
              {
                type: "text",
                text: daysLate.toString()
              },
              {
                type: "currency",
                currency: {
                  fallback_value: `$${amount.toFixed(2)}`,
                  code: "CAD",
                  amount_1000: amountInCents
                }
              },
              {
                type: "text",
                text: interacLink
              },
              {
                type: "text",
                text: n4Link || "N/A" // If N4 form link is available
              }
            ]
          }
        ]
      }
    };

    // Make the API call to send the message
    const response = await axios.post(
      `${BASE_URL}/messages`,
      messagePayload,
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}`
        }
      }
    );

    logger.debug("WhatsApp late payment message sent successfully");
    console.log("WhatsApp late payment message sent successfully", response.data);

    // Return the message ID from the WhatsApp API
    return response.data.messages[0].id;
  } catch (error) {
    logger.error("Error sending WhatsApp late payment message", error);
    console.log("Error sending WhatsApp late payment message", error);
    throw new Error("Failed to send WhatsApp late payment message");
  }
};

/**
 * Check the status of a WhatsApp message delivery
 */
export const checkMessageStatus = async (messageId: string): Promise<string> => {
  try {
    logger.debug(`Checking status for message ${messageId}`);
    console.log(`Checking status for message ${messageId}`);

    const response = await axios.get(
      `${BASE_URL}/${messageId}`,
      {
        headers: {
          "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}`
        }
      }
    );

    logger.debug("Message status retrieved successfully");
    console.log("Message status:", response.data.status);

    return response.data.status;
  } catch (error) {
    logger.error("Error checking message status", error);
    console.log("Error checking message status", error);
    throw new Error("Failed to check message status");
  }
};

/**
 * Handle webhook events from WhatsApp
 * This is called when WhatsApp sends delivery or read confirmations
 */
export const handleWebhookEvent = (event: any): void => {
  try {
    logger.debug("Received WhatsApp webhook event");
    console.log("Received WhatsApp webhook event:", event);

    // Process different types of events
    if (event.entry && event.entry.length > 0) {
      const changes = event.entry[0].changes;

      if (changes && changes.length > 0 && changes[0].value && changes[0].value.messages) {
        const messages = changes[0].value.messages;

        for (const message of messages) {
          // Process incoming messages - for example, if someone replies to our notification
          logger.debug(`Processing incoming message: ${message.id}`);
          console.log(`Received message: ${message.id} from ${message.from}`);

          // Here we would typically update our notification status in the database
          // and potentially trigger a follow-up action
        }
      }

      // Process status updates
      if (changes && changes.length > 0 && changes[0].value && changes[0].value.statuses) {
        const statuses = changes[0].value.statuses;

        for (const status of statuses) {
          logger.debug(`Processing status update: ${status.id} - ${status.status}`);
          console.log(`Message ${status.id} status updated to: ${status.status}`);

          // Update notification status in database
          // This would call a function to update the status in our database
        }
      }
    }
  } catch (error) {
    logger.error("Error processing webhook event", error);
    console.log("Error processing webhook event", error);
  }
};
