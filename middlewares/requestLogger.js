import logger from '../utils/logger.js';

/**
 * Middleware to log all HTTP requests
 */
export const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // Log request
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    path: req.path,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    userId: req.user?.id || 'anonymous'
  });

  // Capture original res.json to log response
  const originalJson = res.json;
  res.json = function (data) {
    const duration = Date.now() - startTime;

    // Log response
    logger.info('Outgoing response', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.id || 'anonymous'
    });

    // If it's an error response, log with error level
    if (res.statusCode >= 400) {
      logger.error('Error response', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        userId: req.user?.id || 'anonymous',
        error: data.message || data.error
      });
    }

    return originalJson.call(this, data);
  };

  next();
};

/**
 * Middleware to log errors
 */
export const errorLogger = (err, req, res, next) => {
  logger.error('Unhandled error', {
    method: req.method,
    url: req.url,
    error: err.message,
    stack: err.stack,
    userId: req.user?.id || 'anonymous'
  });

  next(err);
};

export default { requestLogger, errorLogger };
