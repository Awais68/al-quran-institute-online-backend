import jwt from "jsonwebtoken";
import sendResponse from "../helper/sendResponse.js";
import "dotenv/config";

export function verifyToken(req, res, next) {
  try {
    const bearerToken = req?.headers?.authorization;

    if (!bearerToken || !bearerToken.startsWith("Bearer ")) {
      return sendResponse(
        res,
        401,
        null,
        true,
        "Access denied. No token provided or invalid format."
      );
    }

    const token = bearerToken.split(" ")[1];

    try {
      const decoded = jwt.verify(token, process.env.AUTH_SECRET);
      req.user = decoded;
      next();
    } catch (error) {
      return sendResponse(res, 403, null, true, "Invalid token");
    }
  } catch (error) {
    return sendResponse(res, 500, null, true, "Token verification failed");
  }
}
