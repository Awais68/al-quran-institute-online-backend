import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import hpp from 'hpp';

// Security middleware configuration

// Helmet: Adds various security headers
const securityHeaders = helmet();

// Rate limiting for auth routes
const authRateLimit = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX) || 5, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Rate limiting for general routes
const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
});

// Data sanitization against NoSQL query injection
const sanitizeMongo = mongoSanitize();

// Data sanitization against XSS
const sanitizeXSS = xss();

// Prevent parameter pollution
const preventParamPollution = hpp({
  whitelist: [],
});

export {
  securityHeaders,
  authRateLimit,
  generalRateLimit,
  sanitizeMongo,
  sanitizeXSS,
  preventParamPollution
};