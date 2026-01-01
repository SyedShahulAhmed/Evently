import AuditLog from "../models/auditLog.model.js";

export const createAuditLog = async ({
  adminId,
  action,
  module,
  metadata = {},
  ipAddress = null,
  userAgent = null,
  userId = null,
  organizerId = null,
  eventId = null
}) => {
  return AuditLog.create({
    adminId,
    action,
    module,
    metadata,
    ipAddress,
    userAgent,
    userId,
    organizerId,
    eventId
  });
};
