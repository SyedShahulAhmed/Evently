import { Router } from "express";
import APIResponse from "../utils/APIResponse.js";
import { HTTP } from "../constants/httpStatus.js";

const router = Router();

router.get("/", (req, res) => {
    return res
        .status(HTTP.OK)
        .json(
            new APIResponse(HTTP.OK, {
                status: "ok",
                uptime: process.uptime(),
                timestamp: new Date().toISOString(),
            }, "Evently API is Healthy 🚀")
        );
});

export default router;