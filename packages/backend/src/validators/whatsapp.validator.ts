import Joi from "joi";

// Schema for WhatsApp webhook verification (GET request)
export const verifyWebhookSchema = Joi.object({
  "hub.mode": Joi.string().valid("subscribe").required(),
  "hub.challenge": Joi.string().required(),
  "hub.verify_token": Joi.string().required(),
});

// Schema for WhatsApp incoming message notification (POST request)
// This is a simplified schema focusing on message status updates
// A full implementation would need a more complex schema to handle various message types
export const messageWebhookSchema = Joi.object({
  object: Joi.string().valid("whatsapp_business_account").required(),
  entry: Joi.array().items(
    Joi.object({
      id: Joi.string().required(), // WhatsApp Business Account ID
      changes: Joi.array().items(
        Joi.object({
          value: Joi.object({
            messaging_product: Joi.string().valid("whatsapp").required(),
            metadata: Joi.object({
              display_phone_number: Joi.string().required(),
              phone_number_id: Joi.string().required(),
            }).required(),
            // Handle statuses or messages
            statuses: Joi.array().items(
              Joi.object({
                id: Joi.string().required(), // Message ID (wamid)
                status: Joi.string().valid("sent", "delivered", "read", "failed").required(),
                timestamp: Joi.string().required(),
                recipient_id: Joi.string().required(), // User's phone number
                // Include 'errors' field if status is 'failed'
                errors: Joi.array().items(Joi.object()).when('status', { is: 'failed', then: Joi.required() })
              })
            ).optional(),
            messages: Joi.array().items(
              // Basic structure for incoming text messages
              Joi.object({
                from: Joi.string().required(), // User's phone number
                id: Joi.string().required(), // Message ID (wamid)
                timestamp: Joi.string().required(),
                type: Joi.string().valid("text", "image", /* other types */).required(),
                text: Joi.object({
                  body: Joi.string().required(),
                }).when('type', { is: 'text', then: Joi.required() })
                // Add structures for other message types (image, audio, etc.) if needed
              })
            ).optional(),
          }).required(),
          field: Joi.string().valid("messages").required(),
        })
      ).required(),
    })
  ).required(),
}).unknown(true); // Allow unknown fields from Meta
