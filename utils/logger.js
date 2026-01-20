import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Define console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Daily rotate file transport for all logs
const allLogsTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'all-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: logFormat,
  level: 'info'
});

// Daily rotate file transport for error logs
const errorLogsTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d',
  format: logFormat,
  level: 'error'
});

// Daily rotate file transport for audit logs (payments, enrollments)
const auditLogsTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'audit-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '90d',
  format: logFormat,
  level: 'info'
});

// Daily rotate file transport for video session logs
const sessionLogsTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'sessions-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d',
  format: logFormat,
  level: 'info'
});

// Create main logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: logFormat,
  transports: [
    allLogsTransport,
    errorLogsTransport
  ],
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(logsDir, 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d'
    })
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join(logsDir, 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d'
    })
  ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'debug'
  }));
}

// Create specialized loggers for different domains
const auditLogger = winston.createLogger({
  format: logFormat,
  transports: [auditLogsTransport],
});

const sessionLogger = winston.createLogger({
  format: logFormat,
  transports: [sessionLogsTransport],
});

// Helper functions for specific log types
const loggers = {
  // General logging
  info: (message, meta = {}) => logger.info(message, meta),
  error: (message, meta = {}) => logger.error(message, meta),
  warn: (message, meta = {}) => logger.warn(message, meta),
  debug: (message, meta = {}) => logger.debug(message, meta),

  // Audit logging for critical business operations
  audit: {
    payment: (action, data) => {
      auditLogger.info('Payment Operation', {
        action,
        timestamp: new Date().toISOString(),
        userId: data.userId,
        studentId: data.studentId,
        amount: data.amount,
        receiptNumber: data.receiptNumber,
        paymentMethod: data.paymentMethod,
        adminId: data.adminId
      });
    },
    
    enrollment: (action, data) => {
      auditLogger.info('Enrollment Operation', {
        action,
        timestamp: new Date().toISOString(),
        studentId: data.studentId,
        course: data.course,
        fees: data.fees,
        enrolledBy: data.enrolledBy
      });
    },
    
    feeStatusChange: (data) => {
      auditLogger.info('Fee Status Change', {
        timestamp: new Date().toISOString(),
        studentId: data.studentId,
        oldStatus: data.oldStatus,
        newStatus: data.newStatus,
        changedBy: data.changedBy,
        reason: data.reason
      });
    },
    
    userAction: (action, data) => {
      auditLogger.info('User Action', {
        action,
        timestamp: new Date().toISOString(),
        userId: data.userId,
        role: data.role,
        targetResource: data.targetResource,
        details: data.details
      });
    }
  },

  // Session logging for video calls
  session: {
    start: (data) => {
      sessionLogger.info('Session Started', {
        timestamp: new Date().toISOString(),
        sessionId: data.sessionId,
        participants: data.participants,
        initiator: data.initiator,
        course: data.course
      });
    },
    
    join: (data) => {
      sessionLogger.info('User Joined Session', {
        timestamp: new Date().toISOString(),
        sessionId: data.sessionId,
        userId: data.userId,
        userName: data.userName,
        userType: data.userType
      });
    },
    
    leave: (data) => {
      sessionLogger.info('User Left Session', {
        timestamp: new Date().toISOString(),
        sessionId: data.sessionId,
        userId: data.userId,
        duration: data.duration
      });
    },
    
    end: (data) => {
      sessionLogger.info('Session Ended', {
        timestamp: new Date().toISOString(),
        sessionId: data.sessionId,
        duration: data.duration,
        participants: data.participants,
        peakParticipants: data.peakParticipants
      });
    },
    
    error: (data) => {
      sessionLogger.error('Session Error', {
        timestamp: new Date().toISOString(),
        sessionId: data.sessionId,
        userId: data.userId,
        error: data.error,
        errorType: data.errorType
      });
    }
  }
};

export default loggers;