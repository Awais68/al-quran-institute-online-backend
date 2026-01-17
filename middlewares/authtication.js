import sendResponse from "../helper/sendResponse.js";
import jwt from "jsonwebtoken";
import "dotenv/config";
import User from "../models/user.js";

// Fixed the default export function name and logic
export default async function authenticate(req, res, next) {
  try {
    const bearerToken = req?.headers?.authorization;
    if (!bearerToken || !bearerToken.startsWith("Bearer ")) {
      return sendResponse(
        res,
        401,
        null,
        true,
        "No token provided or invalid format"
      );
    }

    const token = bearerToken.split(" ")[1];
    let decoded;

    try {
      decoded = jwt.verify(token, process.env.AUTH_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return sendResponse(res, 401, null, true, "Token has expired");
      }
      return sendResponse(res, 401, null, true, "Invalid token");
    }

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return sendResponse(res, 401, null, true, "User not found");
    }

    req.user = user;
    return next();
  } catch (err) {
    console.error("Authentication error:", err);
    return sendResponse(res, 500, null, true, "Authentication error occurred");
  }
}

// Fixed the admin authentication function
export function authenticateAdmin(req, res, next) {
  try {
    const bearerToken = req.headers?.authorization;

    if (!bearerToken || !bearerToken.startsWith("Bearer ")) {
      return sendResponse(
        res,
        401,
        null,
        true,
        "Token Not Provided or Invalid Format"
      );
    }

    const token = bearerToken.split(" ")[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.AUTH_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return sendResponse(res, 401, null, true, "Token has expired");
      }
      return sendResponse(res, 401, null, true, "Invalid token");
    }

    // Find user by ID and check role
    User.findById(decoded.id)
      .select("-password")
      .then(user => {
        if (!user) {
          return sendResponse(res, 401, null, true, "User not found");
        }

        if (user.role !== "Admin") {
          return sendResponse(res, 403, null, true, "Admin access required");
        }

        req.user = user;
        next();
      })
      .catch(err => {
        console.error("Admin authentication error:", err);
        return sendResponse(res, 500, null, true, "Authentication error occurred");
      });
  } catch (error) {
    console.error("Admin authentication error:", error);
    return sendResponse(res, 500, null, true, "Authentication error occurred");
  }
}

// Export authenticate as both default and named 'authorization'
export { authenticate as authorization };