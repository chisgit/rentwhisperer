// WhatsApp Templates for Rent Whisperer

/*
  Template Name: rent_due_reminder
  Category: UTILITY
  Language: en_US
*/
{
  "name": "rent_due_reminder",
  "language": "en_US",
  "category": "UTILITY",
  "components": [
    {
      "type": "HEADER",
      "format": "TEXT",
      "text": "Rent Due Notice - {{1}}",
      "example": {
        "header_text": ["Unit 101, 123 Main Street, Toronto, ON M5V 1A1"]
      }
    },
    {
      "type": "BODY",
      "text": "Hello {{1}},\n\nThis is a friendly reminder that your rent payment of {{3}} is due on {{2}}. Please use the following link to make your payment:\n\n{{4}}\n\nThank you for your prompt attention to this matter.",
      "example": {
        "body_text": [
          ["John Smith", "May 1, 2023", "$1,500.00", "https://interac.mock/request?reference=123"]
        ]
      }
    },
    {
      "type": "FOOTER",
      "text": "This is an automated message from your property management system."
    }
  ]
}

/*
  Template Name: rent_late_notice
  Category: UTILITY
  Language: en_US
*/
{
  "name": "rent_late_notice",
  "language": "en_US",
  "category": "UTILITY",
  "components": [
    {
      "type": "HEADER",
      "format": "TEXT",
      "text": "Overdue Rent Notice - {{1}}",
      "example": {
        "header_text": ["Unit 101, 123 Main Street, Toronto, ON M5V 1A1"]
      }
    },
    {
      "type": "BODY",
      "text": "Hello {{1}},\n\nYour rent payment is now {{2}} days overdue. The outstanding amount is {{3}}.\n\nPlease make your payment immediately using the following link:\n\n{{4}}\n\nIf you have already made the payment, please disregard this message.",
      "example": {
        "body_text": [
          ["John Smith", "5", "$1,500.00", "https://interac.mock/request?reference=123"]
        ]
      }
    },
    {
      "type": "FOOTER",
      "text": "This is an automated message from your property management system. If you're experiencing financial difficulties, please contact your property manager to discuss payment options."
    }
  ]
}

/* 
  Instructions for setting up WhatsApp templates:
  
  1. Go to Facebook Business Manager (business.facebook.com)
  2. Navigate to your WhatsApp Business Account
  3. Go to Message Templates
  4. Create a new template with the format above
  5. Submit for approval
  
  Note: Templates can take 24-48 hours for approval by Meta.
  
  These templates are designed to comply with WhatsApp's Business Policy guidelines:
  - They clearly identify the purpose of the message
  - They avoid promotional content
  - They provide necessary information for the tenant
  - They include options for the tenant to respond
*/
