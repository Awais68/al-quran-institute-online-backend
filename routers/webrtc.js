import express from "express";
import crypto from "crypto";
import sendResponse from "../helper/sendResponse.js";
import authorization from "../middlewares/authtication.js";
import logger from "../utils/logger.js";

/**
 * ICE configuration for the browser.
 *
 * TURN credentials must never ship in the frontend bundle, so the client asks
 * for them here with its JWT and gets back a pair that expires in minutes.
 *
 * Three ways to configure it, checked in this order:
 *
 * 1. TURN_URLS + TURN_STATIC_AUTH_SECRET — coturn running with
 *    `use-auth-secret` / `static-auth-secret`. The username is
 *    "<unix expiry>:<user id>" and the password is its HMAC-SHA1 under the
 *    shared secret. coturn validates it without any per-user account.
 * 2. TURN_URLS + TURN_USERNAME + TURN_PASSWORD — long-term credentials from a
 *    managed provider. They do not expire, but they still stay server-side.
 * 3. Nothing — STUN only. Calls still connect on most home networks and fail
 *    behind symmetric NAT (common on mobile carriers), which is what TURN is
 *    there to relay around.
 */
const webrtcRouter = express.Router();

const DEFAULT_STUN = [
  "stun:stun.l.google.com:19302",
  "stun:stun1.l.google.com:19302",
];

const splitList = (value) =>
  (value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const stunServers = () => {
  const urls = splitList(process.env.STUN_URLS);
  return [{ urls: urls.length > 0 ? urls : DEFAULT_STUN }];
};

/** coturn's REST API: username is the expiry, password is its HMAC. */
const ephemeralCredentials = (secret, userId, ttlSeconds) => {
  const username = `${Math.floor(Date.now() / 1000) + ttlSeconds}:${userId}`;
  const credential = crypto
    .createHmac("sha1", secret)
    .update(username)
    .digest("base64");
  return { username, credential };
};

webrtcRouter.get("/ice", authorization, (req, res) => {
  const turnUrls = splitList(process.env.TURN_URLS);
  const ttl = Number(process.env.TURN_TTL_SECONDS) || 600;

  if (turnUrls.length === 0) {
    // Not an error: the caller falls back to STUN and the call still works on
    // networks that do not need a relay.
    return sendResponse(
      res,
      200,
      { iceServers: stunServers(), ttl, turn: false },
      false,
      "No TURN server configured; returning STUN only"
    );
  }

  const secret = process.env.TURN_STATIC_AUTH_SECRET;
  const credentials = secret
    ? ephemeralCredentials(secret, String(req.user._id), ttl)
    : process.env.TURN_USERNAME && process.env.TURN_PASSWORD
    ? {
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_PASSWORD,
      }
    : null;

  if (!credentials) {
    logger.warn("TURN_URLS is set but no credentials are configured", {
      userId: req.user._id,
    });
    return sendResponse(
      res,
      200,
      { iceServers: stunServers(), ttl, turn: false },
      false,
      "TURN is misconfigured; returning STUN only"
    );
  }

  const iceServers = [
    ...stunServers(),
    { urls: turnUrls, username: credentials.username, credential: credentials.credential },
  ];

  // The credentials are short-lived, so this response must not be cached by a
  // proxy and handed to the next user.
  res.set("Cache-Control", "no-store");
  return sendResponse(res, 200, { iceServers, ttl, turn: true }, false, "ICE servers issued");
});

export default webrtcRouter;
