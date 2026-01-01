import Notification from "../models/notification.model.js";
import { sendEmail } from "../utils/sendEmail.js";


export const sendInAppNotification = async ({
  userId = null,
  organizerId = null,
  title,
  message,
  type = "info",
}) => {
  return Notification.create({
    userId,
    organizerId,
    title,
    message,
    type,
  });
};

export const sendRegistrationSuccessEmail = async (email, event) => {
  return sendEmail({
    to: email,
    subject: `You're Registered for ${event.title}! 🎉`,
    intro: `Thanks for registering for <b>${event.title}</b>. Your spot is confirmed!`,
    instruction: {
      text: "View event details below:",
      buttonText: "View Event",
      buttonLink: `${process.env.FRONTEND_URL}/events/${event._id}`,
    },
    outro: "See you at the event!",
  });
};

export const sendTicketEmail = async (email, event, qrUrl) => {
  return sendEmail({
    to: email,
    subject: `🎟️ Your Ticket for ${event.title}`,
    intro: `Here is your ticket for <b>${event.title}</b>.`,
    instruction: {
      text: "Click the button to view or download your QR ticket.",
      buttonText: "View Ticket",
      buttonLink: qrUrl,
    },
    outro: "Please show this QR code at entry!",
  });
};

export const sendOrganizerApprovalEmail = async (email) => {
  return sendEmail({
    to: email,
    subject: "Your Organizer Account is Approved 🎉",
    intro: "Congratulations! Your organizer account has been approved.",
    instruction: {
      text: "You can now create & manage events.",
      buttonText: "Go to Dashboard",
      buttonLink: `${process.env.FRONTEND_URL}/organizer/dashboard`,
    },
    outro: "Welcome aboard! 🚀",
  });
};

export const sendOrganizerRejectionEmail = async (email) => {
  return sendEmail({
    to: email,
    subject: "Organizer Account Rejected ❌",
    intro: "We’re sorry, but your organizer application was rejected.",
    outro: "If you believe this is a mistake, please contact support.",
  });
};

export const sendEventCancelledEmail = async (email, event) => {
  return sendEmail({
    to: email,
    subject: `${event.title} Has Been Cancelled`,
    intro: `Unfortunately, <b>${event.title}</b> has been cancelled.`,
    outro: "We apologize for the inconvenience.",
  });
};

export const sendEventReminderEmail = async (email, event) => {
  return sendEmail({
    to: email,
    subject: `Reminder: ${event.title} is Tomorrow ⏰`,
    intro: `This is a reminder that <b>${event.title}</b> starts tomorrow.`,
    instruction: {
      text: "Click below to view event details:",
      buttonText: "View Event",
      buttonLink: `${process.env.FRONTEND_URL}/events/${event._id}`,
    },
    outro: "Excited to see you there!",
  });
};


export const sendAdminNotification = async ({
  adminId,
  title,
  message,
  type = "info"
}) => {
  return Notification.create({
    adminId,
    title,
    message,
    type
  });
};

