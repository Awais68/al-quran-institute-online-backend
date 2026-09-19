import sendResponse from "../helper/sendResponse.js";
import jwt from "jsonwebtoken";
import "dotenv/config";
import User from "../models/user.js";

// Accounts created by an admin get a generated password and `mustResetPassword`
// set. Until that password is changed the token is only good for the
// change-password endpoint itself — everything else answers 403 with
// PASSWORD_RESET_REQUIRED so the client knows where to send the user.
// The auth router is mounted at three paths (see index.js), hence the variants.
const PASSWORD_RESET_EXEMPT = new Set([
  "/auth/change-password",
  "/signup/change-password",
  "/login/change-password",
]);

const needsPasswordReset = (req, user) =>
  user.mustResetPassword === true &&
  !PASSWORD_RESET_EXEMPT.has(`${req.baseUrl}${req.path}`.replace(/\/+$/, ""));

const PASSWORD_RESET_RESPONSE = [
  403,
  { code: "PASSWORD_RESET_REQUIRED" },
  true,
  "You must change your password before using this account.",
];

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

    // Enforced on every request, not just at login, so deactivating an account
    // invalidates tokens that were already issued to it.
    if (user.status === "inactive") {
      return sendResponse(res, 403, null, true, "This account has been deactivated");
    }

    if (needsPasswordReset(req, user)) {
      return sendResponse(res, ...PASSWORD_RESET_RESPONSE);
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

        if (user.status === "inactive") {
          return sendResponse(res, 403, null, true, "This account has been deactivated");
        }

        if (user.role !== "Admin") {
          return sendResponse(res, 403, null, true, "Admin access required");
        }

        if (needsPasswordReset(req, user)) {
          return sendResponse(res, ...PASSWORD_RESET_RESPONSE);
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