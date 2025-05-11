# RentWhisperer System Architecture Vector

This document maps the entire RentWhisperer system architecture, including module roles, schema relationships, service interdependencies, and data flow paths. It serves as a comprehensive reference for the AI tools to understand the system.

## Database Schema

### Core Entities

#### Tenants
- **Purpose**: Stores tenant personal information only
- **Key Fields**: `id`, `first_name`, `last_name`, `email`, `phone`
- **Relationships**:
  - One-to-many with `tenant_units` (one tenant can have multiple units)
  - One-to-many with `rent_payments` (one tenant can have multiple payments)
  - One-to-many with `notifications` (one tenant can receive multiple notifications)
- **Info**: Represents a person who rents a unit

#### Units
- **Purpose**: Stores unit information
- **Key Fields**: `id`, `unit_number`, `property_id`
- **Relationships**:
  - Many-to-one with `properties` (many units belong to one property)
  - One-to-many with `tenant_units` (one unit can have multiple tenants)
  - One-to-many with `rent_payments` (one unit can have multiple payments)

#### Properties
- **Purpose**: Stores property information
- **Key Fields**: `id`, `name`, `address`, `city`, `province`, `postal_code`, `landlord_id`
- **Relationships**:
  - Many-to-one with `landlords` (many properties belong to one landlord)
  - One-to-many with `units` (one property can have multiple units)

#### TenantUnits (Junction Table)
- **Purpose**: Links tenants to units with tenant-specific rent details
- **Key Fields**: `tenant_id`, `unit_id`, `is_primary`, `lease_start`, `lease_end`, `rent_amount`, `rent_due_day`
- **Relationships**:
  - Many-to-one with `tenants` (many tenant-unit relationships for one tenant)
  - Many-to-one with `units` (many tenant-unit relationships for one unit)
- **Critical Role**: Stores the tenant-specific rent amount and due day that are used by the cron job

#### Rent Payments
- **Purpose**: Tracks rent payments, status, and due dates
- **Key Fields**: `id`, `tenant_id`, `unit_id`, `amount`, `due_date`, `payment_date`, `status`, `is_late`, `payment_method`, `interac_request_link`
- **Relationships**:
  - Many-to-one with `tenants` (many payments from one tenant)
  - Many-to-one with `units` (many payments for one unit)
  - One-to-many with `notifications` (one payment can trigger multiple notifications)
- **Status Values**: `pending`, `paid`, `late`, `partial`

#### Notifications
- **Purpose**: Tracks notifications sent to tenants
- **Key Fields**: `id`, `tenant_id`, `payment_id`, `type`, `channel`, `status`, `message_id`, `sent_at`
- **Relationships**:
  - Many-to-one with `tenants` (many notifications to one tenant)
  - Many-to-one with `rent_payments` (many notifications for one payment)
- **Type Values**: `rent_due`, `rent_late`, `receipt`, `form_n4`, `form_l1`
- **Channel Values**: `whatsapp`, `email`
- **Status Values**: `pending`, `sent`, `delivered`, `read`, `failed`

### Schema Relationships Diagram

```
Landlords 1──┐
             │
             ▼
Properties 1──┐
              │
              ▼
         ┌───Units───┐
         │           │
         ▼           ▼
Tenants──┴─TenantUnits
   │
   │
   ├─────────┬─────────┐
   │         │         │
   ▼         ▼         ▼
RentPayments─┴─Notifications
```

## Backend Services

### Tenant Service (`tenant.service.ts`)
- **Purpose**: Manages tenant data and relationships
- **Key Functions**:
  - `getAllTenants()`: Retrieves all tenants with unit and property information
  - `getTenantById(id)`: Retrieves a specific tenant with unit and property information
  - `createTenant(tenantData)`: Creates a new tenant
  - `updateTenant(id, tenantData)`: Updates an existing tenant
  - `getAllUnits()`: Retrieves all units with property information
- **Dependencies**:
  - Supabase client for database operations
  - Database schema: `tenants`, `tenant_units`, `units`, `properties`
- **Called By**:
  - `tenants.ts` routes
  - `cron.ts` routes (for tenant information in notifications)

### Rent Service (`rent.service.ts`)
- **Purpose**: Handles rent payment generation and status updates
- **Key Functions**:
  - `createRentPayment(paymentData)`: Creates a new rent payment record
  - `getRentPaymentById(id)`: Retrieves a specific rent payment by ID
  - `getRentPaymentsByTenantId(tenantId)`: Retrieves all rent payments for a tenant
  - `getPendingRentPayments()`: Retrieves all pending rent payments
  - `updateRentPaymentStatus(id, status, paymentDate)`: Updates a rent payment status
  - `generateRentDueToday()`: Generates rent due records for tenants with rent due today
  - `updateLateRentPayments()`: Updates status of overdue payments to 'late'
  - `generateRentPaymentsForAllTenants()`: Generates rent payments for all tenants regardless of rent due day
- **Dependencies**:
  - Supabase client for database operations
  - Payment Service for generating Interac request links
  - Database schema: `rent_payments`, `tenant_units`, `tenants`, `units`
- **Called By**:
  - `rent.ts` routes
  - `cron.ts` routes (for generating and updating payments)
- **Info**: Manages rent payments, including generation, retrieval, and status updates

### Payment Service (`payment.service.ts`)
- **Purpose**: Processes payments and generates payment links
- **Key Functions**:
  - `generateInteracRequestLink(recipientEmail, recipientName, amount, message)`: Generates an Interac e-Transfer request link
  - `processPaymentResponse(paymentId, status)`: Processes a payment response
  - `createPayment(paymentData)`: Creates a new payment
  - `getPayment(paymentId)`: Retrieves a specific payment
  - `updatePayment(paymentId, paymentData)`: Updates a payment
  - `listPayments(tenantId, unitId)`: Lists payments with optional filtering
- **Dependencies**:
  - Supabase client for database operations
  - Database schema: `rent_payments`
- **Called By**:
  - Rent Service (for generating Interac request links)
  - `rent.ts` routes (for payment operations)

### Notification Service (`notification.service.ts`)
- **Purpose**: Sends and tracks notifications
- **Key Functions**:
  - `createNotification(tenantId, type, channel, paymentId, messageId)`: Creates a notification record
  - `updateNotificationStatus(notificationId, status, messageId)`: Updates a notification status
  - `sendRentDueNotification(tenant, payment, unit, propertyAddress)`: Sends a rent due notification
  - `sendRentLateNotification(tenant, payment, unit, propertyAddress, daysLate)`: Sends a rent late notification
- **Dependencies**:
  - Supabase client for database operations
  - WhatsApp Service for sending messages
  - Database schema: `notifications`, `tenants`, `rent_payments`, `units`
- **Called By**:
  - `cron.ts` routes (for sending notifications)

### WhatsApp Service (`whatsapp.service.ts`)
- **Purpose**: Sends WhatsApp messages
- **Key Functions**:
  - `sendRentDueMessage(phone, name, dueDate, amount, unitAddress, interacLink)`: Sends a rent due message
  - `sendRentLateMessage(phone, name, daysLate, amount, unitAddress, interacLink)`: Sends a rent late message
- **Dependencies**:
  - Meta Cloud API for WhatsApp
- **Called By**:
  - Notification Service (for sending WhatsApp messages)

## Cron Jobs and Automation

### Cron Routes (`cron.ts`)
- **Purpose**: Endpoints for automated tasks triggered by cron jobs
- **Key Endpoints**:
  - `/due-rent`: Generates rent due records and sends notifications
  - `/late-rent`: Updates late statuses and sends late rent notifications
  - `/form-n4`: Identifies tenants eligible for N4 forms (rent 14+ days late)
  - `/form-l1`: Identifies tenants eligible for L1 forms (rent 15+ days late)
  - `/past-due-day`: Identifies tenants who have passed their rent due day
- **Dependencies**:
  - Rent Service for payment operations
  - Tenant Service for tenant information
  - Notification Service for sending notifications
  - Database schema: `tenant_units`, `rent_payments`, `tenants`, `units`, `properties`
- **Critical Process**: Monthly job that scans TenantUnits, creates due payments, flags late ones

### Monthly Rent Generation Process
1. Cron job triggers `/due-rent` endpoint
2. `rentService.generateRentDueToday()` is called
3. System queries `tenant_units` for tenants with rent due on the current day
4. For each tenant-unit, a new rent payment record is created if one doesn't exist
5. Interac request links are generated for each payment
6. Notifications are sent to tenants

### Late Rent Update Process
1. Cron job triggers `/late-rent` endpoint
2. `rentService.updateLateRentPayments()` is called
3. System finds all pending payments with due dates before today
4. Updates their status to 'late'
5. Notifications are sent to tenants with late payments
6. If payment is 14+ days late, it may be flagged for N4 form
7. If payment is 15+ days late, it may be flagged for L1 form

## Frontend Components

### API Service (`api.service.ts`)
- **Purpose**: Handles API calls to the backend
- **Key Functions**:
  - `tenantsApi`: Methods for tenant operations
  - `paymentsApi`: Methods for payment operations
  - `notificationsApi`: Methods for notification operations
  - `cronApi`: Methods for triggering cron jobs
  - `pdfApi`: Methods for generating PDFs
- **Dependencies**:
  - Backend API endpoints
- **Called By**:
  - Frontend components and pages

### Payments Page (`Payments.tsx`)
- **Purpose**: Displays and manages rent payments
- **Key Features**:
  - Lists all payments with filtering options
  - Allows marking payments as paid
  - Displays payment details and status
- **Dependencies**:
  - API Service for data operations
  - Payment Confirmation Modal for confirming payments
- **Data Flow**: Fetches payment data from the backend and displays it to the user

## Data Flow Paths

### Rent Due Generation Flow
1. Cron job triggers `/due-rent` endpoint
2. `rentService.generateRentDueToday()` queries `tenant_units` for tenants with rent due today
3. For each tenant-unit, a new `rent_payment` record is created
4. `paymentService.generateInteracRequestLink()` creates a payment link
5. `sendRentDueNotification()` sends a notification to the tenant
6. Notification record is created in the `notifications` table

### Payment Processing Flow
1. User marks a payment as paid in the frontend
2. API call to update payment status
3. `rentService.updateRentPaymentStatus()` updates the payment record
4. Receipt notification may be sent to the tenant

## Critical Dependencies and Constraints

1. **TenantUnits Junction Table**: Central to the system as it stores the tenant-specific rent amount and due day
2. **Rent Generation Process**: Depends on accurate `rent_due_day` values in the `tenant_units` table
3. **Notification System**: Depends on WhatsApp integration for message delivery
4. **Payment Processing**: Uses mock Interac integration that would need to be replaced with real integration
5. **Database Schema**: Uses Supabase with Row Level Security (RLS) policies
