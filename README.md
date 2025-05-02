# Rent Whisperer

A zero-cost MVP for automating rent collection and late notices via WhatsApp, with automatic Ontario LTB form generation.

## Features

- 📱 WhatsApp rent notices using Meta Cloud API
- 💰 Generate Interac e-Transfer request links
- 📄 Auto-generate Ontario LTB Form N4 and L1 documents
- 🔄 Automated workflows for due dates and late payments
- 🗄️ Data storage on Supabase (free tier)
- 🚀 Deployment on Render free web service

## Project Structure

This is a monorepo with the following packages:

- `packages/backend`: REST API for tenant and payment management
- `packages/pdf-service`: PDF generation service for LTB forms
- `packages/web`: Future web frontend (React PWA)

## Getting Started

### Prerequisites

- Node.js v20+
- Supabase account (free tier)
- Meta Developer account (for WhatsApp API)

### Setup

1. Clone the repository
2. Install dependencies

```bash
npm install
```

3. Copy environment variables

```bash
cp packages/backend/.env.example packages/backend/.env
cp packages/pdf-service/.env.example packages/pdf-service/.env
```

4. Update the environment variables with your credentials

5. Start the services

```bash
npm run dev
```

## Supabase Database Schema

The project uses the following tables in Supabase:

- **tenants**: Store tenant information
- **properties**: Store property details
- **units**: Store rental units linked to properties
- **rent_payments**: Track rent payments and status
- **notifications**: Record of sent WhatsApp messages
- **incoming_messages**: Store tenant responses

## API Endpoints

### Tenant Management

- `GET /api/tenants`: List all tenants
- `GET /api/tenants/:id`: Get tenant details
- `POST /api/tenants`: Add a new tenant
- `PATCH /api/tenants/:id`: Update tenant details

### Rent Processing

- `GET /api/rent`: List all rent payments
- `GET /api/rent/:id`: Get payment details
- `POST /api/rent`: Create a new rent payment
- `PATCH /api/rent/:id/status`: Update payment status

### WhatsApp Integration

- `GET /api/whatsapp/webhook`: Webhook verification
- `POST /api/whatsapp/webhook`: Receive WhatsApp webhooks

### Form Generation

- `POST /api/pdf/generate-n4`: Generate N4 form
- `POST /api/pdf/generate-l1`: Generate L1 form

### Cron Jobs

- `GET /cron/due-rent`: Process today's due rent notifications
- `GET /cron/late-rent`: Process late rent notifications
- `GET /cron/form-n4`: Generate N4 forms (14+ days late)
- `GET /cron/form-l1`: Generate L1 forms (15+ days late)

## License

This project is open source and available under the MIT License.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
