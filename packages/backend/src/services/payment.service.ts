import { logger } from "../utils/logger";
import { supabase } from "../config/database";

export class PaymentService {
  /**
   * Generate an Interac e-Transfer request link
   * 
   * For the MVP, this will not actually interface with Interac's API
   * Instead, we'll generate a mock link that could later be replaced with a real implementation
   * 
   * @param recipientEmail - Email of the person to request money from
   * @param recipientName - Name of the person to request money from
   * @param amount - Amount to request in dollars
   * @param message - Optional message to include with the request
   */
  async generateInteracRequestLink(
    recipientEmail: string,
    recipientName: string,
    amount: number,
    message: string = "Rent payment"
  ): Promise<string> {
    logger.debug(`Generating Interac request link for ${recipientEmail} for $${amount}`);
    console.log(`Generating Interac request link for ${recipientEmail} for $${amount}`);

    // For the MVP, we'll generate a mock link that includes the parameters
    // This would be replaced with actual Interac API integration in the future

    // Encode parameters for the URL
    const params = new URLSearchParams({
      email: recipientEmail,
      name: recipientName,
      amount: amount.toString(),
      message: message,
      reference: `rent-${Date.now()}`
    }).toString();

    // In a real implementation, this would make an API call to Interac's services
    // For now, we're just generating a link that looks like it could be an Interac request
    const mockInteracLink = `https://interac.mock/request?${params}`;

    // In a production app, we would validate this link and ensure it's working
    return mockInteracLink;
  }

  /**
   * Process a payment response
   * This would be called when a tenant responds to a payment request
   * 
   * @param paymentId - ID of the payment in our system
   * @param status - Status of the payment (success, declined, etc.)
   */
  async processPaymentResponse(
    paymentId: string,
    status: "success" | "declined" | "pending"
  ): Promise<boolean> {
    logger.debug(`Processing payment response for payment ${paymentId} with status ${status}`);
    console.log(`Processing payment response for payment ${paymentId} with status ${status}`);

    // In a real implementation, this would verify the payment with Interac's API
    // and update our database accordingly

    // For the MVP, we'll just return true for successful payments
    return status === "success";
  }

  async createPayment(paymentData: any): Promise<any> {
    logger.debug(`Creating payment with data: ${JSON.stringify(paymentData)}`);
    console.log(`Creating payment with data: ${JSON.stringify(paymentData)}`);
    // In a real implementation, this would create a new payment record in the database
    // For now, we'll just return a mock payment object
    const mockPayment = {
      id: "payment-" + Date.now(),
      ...paymentData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return mockPayment;
  }

  async getPayment(paymentId: string): Promise<any> {
    logger.debug(`Getting payment with id: ${paymentId}`);
    console.log(`Getting payment with id: ${paymentId}`);
    // In a real implementation, this would retrieve the payment record from the database
    // For now, we'll just return a mock payment object
    const mockPayment = {
      id: paymentId,
      tenantId: "tenant-1",
      unitId: "unit-1",
      amount: 1800,
      dueDate: new Date(),
      paymentDate: new Date(),
      isLate: false,
      status: "paid",
      paymentMethod: "credit_card",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return mockPayment;
  }

  async updatePayment(paymentId: string, paymentData: any): Promise<any> {
    logger.debug(`Updating payment with id: ${paymentId} and data: ${JSON.stringify(paymentData)}`);
    console.log(`Updating payment with id: ${paymentId} and data: ${JSON.stringify(paymentData)}`);
    // In a real implementation, this would update the payment record in the database
    // For now, we'll just return a mock payment object
    const mockPayment = {
      id: paymentId,
      ...paymentData,
      updatedAt: new Date(),
    };
    return mockPayment;
  }
  async listPayments(tenantId?: string, unitId?: string): Promise<any[]> {
    logger.debug(`Listing payments for tenantId: ${tenantId} and unitId: ${unitId}`);
    console.log(`Listing payments for tenantId: ${tenantId} and unitId: ${unitId}`);

    // Query both tenant and unit information with proper joins
    let query = supabase
      .from('rent_payments')
      .select(`
        *,
        tenants (first_name, last_name),
        units (unit_number)
      `);

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }
    if (unitId) {
      query = query.eq('unit_id', unitId);
    }

    const { data, error } = await query;

    if (error) {
      logger.error(`Error fetching payments: ${error.message}`);
      console.log(`Error fetching payments: ${error.message}`);
      throw error;
    }

    // Transform the data to match the frontend expectations
    // The frontend expects tenant_name and unit_number as direct properties
    const formattedData = data.map((payment: any) => {
      // Get tenant name from nested tenant object
      const tenant_name = payment.tenants ?
        `${payment.tenants.first_name} ${payment.tenants.last_name}` :
        'Unknown Tenant';

      // Get unit number from nested unit object
      const unit_number = payment.units ? payment.units.unit_number : 'Unknown Unit';

      // Add debug logging to see the data structure
      console.log(`DEBUG: Processing payment ${payment.id} - tenant: ${tenant_name}, unit: ${unit_number}`);

      // Return restructured payment with flattened properties
      return {
        ...payment,
        tenant_name,
        unit_number
      };
    });

    console.log(`DEBUG: Returning ${formattedData.length} formatted payments`);
    return formattedData;
  }
}

export const paymentService = new PaymentService();
