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
        403,
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
      return sendResponse(res, 403, null, true, "Invalid or expired token");
    }

    const user = await User.findById(decoded._id);
    if (!user) {
      return sendResponse(res, 403, null, true, "User Not Found");
    }

    req.user = user;
    return next();
  } catch (err) {
    return sendResponse(res, 500, null, true, "An unexpected error occurred");
  }
}

// Fixed the admin authentication function
export function authenticateAdmin(req, res, next) {
  try {
    // Fixed typo: 'authorizations' should be 'authorization'
    const bearerToken = req.headers?.authorization;

    if (!bearerToken || !bearerToken.startsWith("Bearer ")) {
      return sendResponse(
        res,
        400,
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
      return sendResponse(res, 403, null, true, "Invalid or expired token");
    }

    req.user = decoded;

    if (decoded.role !== "admin") {
      return sendResponse(res, 403, null, true, "Admin only allowed to Access");
    }

    console.log("decoded=>", decoded);
    next();
  } catch (error) {
    return sendResponse(res, 500, null, true, "Authentication error occurred");
  }
}
