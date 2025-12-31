import { HTTP } from "../constants/httpStatus.js";
import APIError from "../utils/APIError.js";

const errorMiddleware = (err, req, res, next) => {
    // If it's our custom error class
    if (err instanceof APIError) {
        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
            errors: err.errors || [],
            stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
        });
    }

    // Any other unknown error
    console.log("🔥 UNHANDLED ERROR:", err);

    return res.status(HTTP.BAD_REQUEST).json({
        success: false,
        message: "Internal Server Error",
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
};

export default errorMiddleware;