# Rent Whisperer Project Vector File
# Last updated: 2025-05-02

## Project Structure
- Monorepo with workspaces: backend, pdf-service, web
- Backend: Node.js/TypeScript (Express, Supabase, WhatsApp, Interac, PDF)
- PDF Service: Node.js/TypeScript microservice for PDF generation
- Web: React/TypeScript (Vite, Tailwind CSS)
- Config: supabase_schema.sql, whatsapp_templates.js

## Key Files & Directories
- packages/backend/src/routes: cron.ts, pdf.ts, rent.ts, tenants.ts, whatsapp.ts
- packages/backend/src/services: notification, payment, rent, tenant, whatsapp
- packages/backend/src/utils/logger.ts
- packages/pdf-service/src/services/pdfGenerator.service.ts
- packages/web/src/pages: Dashboard, Tenants, Payments, Notifications
- packages/web/src/components: Button, Card, FormElements, Layout, Modal, Navbar, PaymentConfirmationModal, Sidebar, TenantForm
- packages/web/src/services/api.service.ts

## Rules & Conventions (from .github/copilot/rules.yml)
- TypeScript, double quotes, 2-space indentation
- Never delete debug statements (console.log, logger.debug, etc.)
- No breaking changes; maintain all existing behaviour
- Each PR = one small, independent, test-covered slice of value
- Use PowerShell syntax for terminal commands on Windows
- Follow Tailwind CSS conventions for styling
- Architecture: Supabase, Render, Meta Cloud API (WhatsApp), Interac eTransfer, pdfkit
- Reference: MicroRealEstate OSS for code reuse

## Notable Integrations
- Supabase (database)
- Render (hosting)
- Meta Cloud API (WhatsApp)
- Interac eTransfer (Request Money links)
- pdfkit (PDF generation)

## Next Steps
- Use this vector file as a quick reference for project structure, rules, and architecture.
- Update as new features, rules, or architecture changes are introduced.
