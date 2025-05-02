import { supabase, Notification, Tenant, RentPayment, Unit } from "../config/database";
import { sendRentDueMessage, sendRentLateMessage } from "./whatsapp.service";
import { logger } from "../utils/logger";

/**
 * Create a notification record
 */
export const createNotification = async (
  tenantId: string,
  type: "rent_due" | "rent_late" | "receipt" | "form_n4" | "form_l1",
  channel: "whatsapp" | "email",
  paymentId?: string,
  messageId?: string
): Promise<Notification> => {
  logger.debug("Creating notification record");
  console.log("Creating notification record for tenant:", tenantId, "type:", type);

  try {
    const { data, error } = await supabase
      .from("notifications")
      .insert({
        tenant_id: tenantId,
        payment_id: paymentId,
        type,
        channel,
        status: messageId ? "sent" : "pending",
        message_id: messageId,
        sent_at: messageId ? new Date().toISOString() : null
      })
      .select()
      .single();

    if (error) {
      logger.error("Error creating notification", error);
      console.log("Error creating notification", error);
      throw new Error("Failed to create notification");
    }

    logger.debug("Notification created successfully");
    console.log("Notification created successfully", data);
    return data;
  } catch (error) {
    logger.error("Error in createNotification", error);
    console.log("Error in createNotification", error);
    throw error;
  }
};

/**
 * Update notification status
 */
export const updateNotificationStatus = async (
  notificationId: string,
  status: "pending" | "sent" | "delivered" | "read" | "failed",
  messageId?: string
): Promise<Notification> => {
  logger.debug(`Updating notification ${notificationId} status to ${status}`);
  console.log(`Updating notification ${notificationId} status to ${status}`);

  try {
    const updateData: Partial<Notification> = {
      status
    };

    if (messageId) {
      updateData.message_id = messageId;
    }

    if (status === "sent" && !updateData.sent_at) {
      updateData.sent_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("notifications")
      .update(updateData)
      .eq("id", notificationId)
      .select()
      .single();

    if (error) {
      logger.error("Error updating notification", error);
      console.log("Error updating notification", error);
      throw new Error("Failed to update notification");
    }

    logger.debug("Notification status updated successfully");
    console.log("Notification status updated successfully", data);
    return data;
  } catch (error) {
    logger.error("Error in updateNotificationStatus", error);
    console.log("Error in updateNotificationStatus", error);
    throw error;
  }
};

/**
 * Send rent due notification to a tenant
 */
export const sendRentDueNotification = async (
  tenant: Tenant,
  payment: RentPayment,
  unit: Unit,
  propertyAddress: string
): Promise<Notification> => {
  logger.debug("Sending rent due notification");
  console.log("Sending rent due notification to tenant:", tenant.first_name, tenant.last_name);

  try {
    // Format the date for display
    const dueDate = new Date(payment.due_date);
    const formattedDate = dueDate.toLocaleDateString("en-CA", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
    
    // Format the unit address
    const unitAddress = `${unit.unit_number}, ${propertyAddress}`;
    
    // Send the WhatsApp message
    const messageId = await sendRentDueMessage(
      tenant.phone,
      `${tenant.first_name} ${tenant.last_name}`,
      formattedDate,
      payment.amount,
      unitAddress,
      payment.interac_request_link || ""
    );
    
    // Create a notification record
    return await createNotification(
      tenant.id,
      "rent_due",
      "whatsapp",
      payment.id,
      messageId
    );
  } catch (error) {
    logger.error("Error sending rent due notification", error);
    console.log("Error sending rent due notification", error);
    throw error;
  }
};

/**
 * Send rent late notification to a tenant
 */
export const sendRentLateNotification = async (
  tenant: Tenant,
  payment: RentPayment,
  unit: Unit,
  propertyAddress: string,
  daysLate: number
): Promise<Notification> => {
  logger.debug("Sending rent late notification");
  console.log("Sending rent late notification to tenant:", tenant.first_name, tenant.last_name);

  try {
    // Format the unit address
    const unitAddress = `${unit.unit_number}, ${propertyAddress}`;
    
    // Send the WhatsApp message
    const messageId = await sendRentLateMessage(
      tenant.phone,
      `${tenant.first_name} ${tenant.last_name}`,
      daysLate,
      payment.amount,
      unitAddress,
      payment.interac_request_link || ""
    );
    
    // Create a notification record
    return await createNotification(
      tenant.id,
      "rent_late",
      "whatsapp",
      payment.id,
      messageId
    );
  } catch (error) {
    logger.error("Error sending rent late notification", error);
    console.log("Error sending rent late notification", error);
    throw error;
  }
};
