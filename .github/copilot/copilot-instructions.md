# Rent Whisperer Project Rules

# Code Style
style:
  language: TypeScript
  quotes: double
  indentation: 2
  target:
    node: 20
    react: 18

# VERY IMPORTANT Development Rules
rules:
  - Use PowerShell for windows syntax for terminal commands
  - Never delete existing debug statements (console.log, logger.debug, etc.)
  - Maintain all existing behaviour; breaking changes are not acceptable
  - Each PR = one small, independent, test-covered slice of value
  - Double quotes for strings
  - Follow Tailwind CSS conventions for styling when possible
# Architecture Constraints
architecture:
  database: Supabase
  hosting: Render (free tier)
  integrations:
    - Meta Cloud API for WhatsApp
    - Interac eTransfer (Request Money links)
  pdf: pdfkit
  references:
    - MicroRealEstate OSS (for potential code reuse)
