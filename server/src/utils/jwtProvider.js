import jwt from "jsonwebtoken";
import crypto from "crypto";

/** Generate unique JWT ID */
const generateJTI = () => crypto.randomUUID();

/** Shared payload */
const buildTokenPayload = (account, req) => ({
    id: account._id,
    role: account.role,   // FIXED
    ua: req?.headers["user-agent"] || "unknown",
    ip: req?.ip || "0.0.0.0",
});


/** Access Token (15 minutes) */
export const generateAccessToken = (account, req) => {
    const payload = buildTokenPayload(account, req);

    return jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "15m",
        issuer: "evently.app",
        jwtid: generateJTI(),
    });
};

/** Refresh Token (7 days) */
export const generateRefreshToken = (account, req) => {
    const payload = buildTokenPayload(account, req);

    return jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {
        expiresIn: "7d",
        issuer: "evently.app",
        jwtid: generateJTI(),
    });
};

/** Verify Access Token */
export const verifyAccessToken = (token) => {
    return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, {
        issuer: "evently.app",
    });
};

/** Verify Refresh Token */
export const verifyRefreshToken = (token) => {
    return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET, {
        issuer: "evently.app",
    });
};
