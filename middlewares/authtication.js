import sendResponse from "../helper/sendResponse.js";
import jwt from "jsonwebtoken";
import "dotenv/config";
import User from "../models/user.js";
// import AsyncStorage from "@react-native-async-storage/async-storage";

export default async function authorization(req, res, next) {
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

    req.user = user; // Set the actual user object
    return next();
  } catch (err) {
    return sendResponse(res, 500, null, true, "An unexpected error occurred");
  }
}

export function authenticateAdmin(req, res, next) {
  const bearerToken = req.headers?.authorizations;
  console.log("bearerToken=>", bearerToken);
  if (!bearerToken)
    return sendResponse(res, 400, null, true, "token Not Provided");
  const token = bearerToken.split(" ")[1];
  const decoded = jwt.verify(token, process.env.AUTH_SECRET);

  req.user = decoded;
  if (decoded.role == "admin") {
    next();
  } else {
    return sendResponse(res, 403, null, true, "Admin only allowed to Acess");
  }
  console.log("decoded=>", decoded);
  next();
}
