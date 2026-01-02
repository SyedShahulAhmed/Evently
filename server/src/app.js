import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { HTTP } from "./constants/httpStatus.js";
const app = express();
import { apiLogger } from "./middlewares/apiLogger.js";
import { errorLogger } from "./middlewares/errorLogger.js";
// ---------- Middlewares ----------
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);
app.use(apiLogger);
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: "20mb" }));
app.use(cookieParser());
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// ---------- Test Route ----------

app.get("/", (req, res) => {
  res.status(HTTP.OK).json({
    success: true,
    message: "Evently API is Running 🚀",
  });
});

// ---------- Health Check ----------
import healthRoutes from "./routes/healthcheck.routes.js";
app.use("/api/v1/healthcheck", healthRoutes);

// ---------- Test Routes ----------
import testRoutes from "./routes/test.routes.js";
app.use("/api/v1/test", testRoutes);

// ---------- Auth Routes ----------
import authRoutes from "./routes/auth.routes.js";
app.use("/api/v1/auth", authRoutes);

// ---------- Admin Routes ----------
import adminRoutes from "./routes/admin.routes.js";
app.use("/api/v1/admin", adminRoutes);

// ---------- User Routes ----------
import userRoutes from "./routes/user.routes.js";
app.use("/api/v1/users", userRoutes);

// ---------- Organizers Routes ----------
import organizerRoutes from "./routes/organizer.routes.js";
app.use("/api/v1/organizer", organizerRoutes);

// ---------- Event Routes ----------
import eventRoutes from "./routes/event.routes.js";
app.use("/api/v1/events", eventRoutes);

// ---------- Error Middleware ----------
import errorMiddleware from "./middlewares/errorMiddleware.js";
app.use(errorMiddleware);

// ---------- Public Event Routes ----------
import publicEventRoutes from "./routes/publicEvent.routes.js";
app.use("/api/v1/events", publicEventRoutes);

// ---------- BookMark Routes ----------
import bookmarkRoutes from "./routes/bookmark.routes.js";
app.use("/api/v1/bookmarks", bookmarkRoutes);

// ---------- Registration Routes ----------
import registrationRoutes from "./routes/registration.routes.js";
app.use("/api/v1/registrations", registrationRoutes);

// ---------- Notification Routes ----------
import notificationRoutes from "./routes/notification.routes.js";
app.use("/api/v1/notifications", notificationRoutes);

app.use(errorLogger);

export default app;
