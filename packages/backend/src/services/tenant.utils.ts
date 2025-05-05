import { Tenant, TenantQueryResult } from "./tenant.queries"; // Assuming TenantQueryResult is exported from queries
import { logger } from "../utils/logger";

// Add functions for data transformation and validation here

/**
 * Transforms raw Supabase tenant query result into the desired Tenant format.
 */
export function transformTenantQueryResult(tenant: TenantQueryResult): Tenant {
  // Find primary unit relationship (if any)
  const primaryRelationship = tenant.tenant_units?.find((tu) => tu.is_primary) || tenant.tenant_units?.[0];
  const primaryUnit = primaryRelationship?.units;
  const properties = primaryUnit?.properties;

  // Explicitly map to Tenant type, converting nulls to undefined for optional fields
  return {
    id: tenant.id,
    first_name: tenant.first_name,
    last_name: tenant.last_name,
    email: tenant.email ?? '', // Convert null to empty string
    phone: tenant.phone,
    created_at: tenant.created_at,
    updated_at: tenant.updated_at,
    unit_id: primaryUnit?.id ?? undefined,
    unit_number: primaryUnit?.unit_number ?? undefined,
    property_name: properties?.name ?? undefined,
    property_address: properties?.address ?? undefined,
    property_city: properties?.city ?? undefined,
    property_province: properties?.province ?? undefined,
    property_postal_code: properties?.postal_code ?? undefined,
    rent_amount: primaryRelationship?.rent_amount ? parseFloat(primaryRelationship.rent_amount) : undefined,
    rent_due_day: primaryRelationship?.rent_due_day ?? undefined,
  };
}

/**
 * Validates required fields for creating a new tenant.
 */
export function validateCreateTenantData(tenantData: any): void {
  if (!tenantData.first_name?.trim()) {
    throw new Error("First name is required");
  }

  if (!tenantData.last_name?.trim()) {
    throw new Error("Last name is required");
  }

  if (!tenantData.phone?.trim()) {
    throw new Error("Phone number is required");
  }
}

/**
 * Validates rent and unit data for creating or updating a tenant.
 */
export function validateRentAndUnitData(unit_id: string | undefined, rent_amount: any, rent_due_day: any, isUpdate: boolean = false): { validatedRentAmount: number | undefined, validatedRentDueDay: number | undefined } {
  let validatedRentAmount = rent_amount;
  let validatedRentDueDay = rent_due_day;

  if (unit_id) {
    // Set defaults for missing values when a unit is assigned
    if (validatedRentAmount === undefined || validatedRentAmount === null ||
      (typeof validatedRentAmount === 'number' && isNaN(validatedRentAmount))) {
      validatedRentAmount = 0;
      logger.debug(`[validateRentAndUnitData] Using default rent_amount: 0`);
    }

    if (validatedRentDueDay === undefined || validatedRentDueDay === null ||
      (typeof validatedRentDueDay === 'number' && isNaN(validatedRentDueDay))) {
      validatedRentDueDay = 1;
      logger.debug(`[validateRentAndUnitData] Using default rent_due_day: 1`);
    }

    // Validate rent amount is not negative
    if (typeof validatedRentAmount === 'number' && validatedRentAmount < 0) {
      throw new Error("Rent amount cannot be negative");
    }

    // Validate rent due day is between 1 and 31
    if (typeof validatedRentDueDay === 'number' && (validatedRentDueDay < 1 || validatedRentDueDay > 31)) {
      throw new Error("Rent due day must be between 1 and 31");
    }
  } else if (isUpdate) {
    // When only updating rent values (not changing unit), validate if provided
    if (rent_amount !== undefined && (typeof rent_amount !== 'number' || isNaN(rent_amount) || rent_amount < 0)) {
      throw new Error("Rent amount must be a non-negative number");
    }

    if (rent_due_day !== undefined && (typeof rent_due_day !== 'number' || isNaN(rent_due_day) || rent_due_day < 1 || rent_due_day > 31)) {
      throw new Error("Rent due day must be a number between 1 and 31");
    }
  }


  logger.debug(`[validateRentAndUnitData] Validated rent values: amount=${validatedRentAmount} (${typeof validatedRentAmount}), due_day=${validatedRentDueDay} (${typeof validatedRentDueDay})`);

  return { validatedRentAmount, validatedRentDueDay };
}

/**
 * Parses rent amount, handling potential string or number inputs and NaN.
 */
export function parseRentAmount(rentAmount: any): number | undefined {
  if (rentAmount === undefined || rentAmount === null) {
    return undefined;
  }
  const parsed = typeof rentAmount === 'string' ? parseFloat(rentAmount) : rentAmount;
  return typeof parsed === 'number' && !isNaN(parsed) ? parsed : undefined;
}

/**
 * Parses rent due day, handling potential string or number inputs and NaN.
 */
export function parseRentDueDay(rentDueDay: any): number | undefined {
  if (rentDueDay === undefined || rentDueDay === null) {
    return undefined;
  }
  const parsed = typeof rentDueDay === 'string' ? parseInt(rentDueDay, 10) : rentDueDay;
  return typeof parsed === 'number' && !isNaN(parsed) ? parsed : undefined;
}
