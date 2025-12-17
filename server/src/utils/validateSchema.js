import APIError from "./APIError.js";
import { HTTP } from "../constants/httpStatus.js";

const validateSchema = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
        const issues = result.error?.issues || [];

        const errors = issues.map((err) => ({
            path: err.path?.join(".") || "unknown",
            message: err.message || "Invalid input",
        }));

        return next(
            new APIError(
                HTTP.BAD_REQUEST,
                "Validation failed",
                errors
            )
        );
    }

    req.body = result.data;
    next();
};

export default validateSchema;
