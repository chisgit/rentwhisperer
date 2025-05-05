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
  - If something is not working, add a debug statement to understand why it is not working
  - If you are not sure about something, ask for clarification
  - Maintain all existing behaviour; breaking changes are not acceptable
  - Each PR = one small, independent, test-covered slice of value
  - Double quotes for strings
  - Follow Tailwind CSS conventions for styling when possible
  - When using replace_string_in_file, include 3-5 lines of unchanged code before and after the string you want to replace
  - When using insert_edit_into_file, avoid repeating existing code; use comments like "// ...existing code..." instead
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
