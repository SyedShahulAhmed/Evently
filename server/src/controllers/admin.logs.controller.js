import asyncHandler from "../utils/asyncHandler.js";
import APIResponse from "../utils/APIResponse.js";
import APIError from "../utils/APIError.js";
import { HTTP } from "../constants/httpStatus.js";
import AuditLog from "../models/auditLog.model.js";
import ApiLog from "../models/apiLog.model.js";
import ErrorLog from "../models/errorLog.model.js";

/**
 * GET /admin/logs/audit
 * Query params: page, limit, module, action, adminId, from, to, sort
 */
export const getAuditLogs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, module, action, adminId, from, to, sort = "-createdAt" } = req.query;
  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

  const filter = {};
  if (module) filter.module = module;
  if (action) filter.action = action;
  if (adminId) filter.adminId = adminId;
  if (from || to) filter.createdAt = {};
  if (from) filter.createdAt.$gte = new Date(from);
  if (to) filter.createdAt.$lte = new Date(to);

  const total = await AuditLog.countDocuments(filter);
  const logs = await AuditLog.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(Number(limit))
    .lean();

  return res.status(HTTP.OK).json(new APIResponse(HTTP.OK, { total, page: Number(page), limit: Number(limit), logs }, "Audit logs fetched"));
});


// 📌 GET API Logs
export const getApiLogs = asyncHandler(async (req, res) => {
  const logs = await ApiLog.find().sort({ createdAt: -1 }).limit(200);

  return res
    .status(HTTP.OK)
    .json(new APIResponse(HTTP.OK, logs, "API logs fetched"));
});

// 📌 GET Error Logs
export const getErrorLogs = asyncHandler(async (req, res) => {
  const errors = await ErrorLog.find().sort({ createdAt: -1 }).limit(200);

  return res
    .status(HTTP.OK)
    .json(new APIResponse(HTTP.OK, errors, "Error logs fetched"));
});