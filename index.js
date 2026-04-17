import express from "express";
import { createServer } from "http";
import morgan from "morgan";
import logger from "./utils/logger.js";
import { requestLogger, errorLogger } from "./middlewares/requestLogger.js";
import authRoutes from "./routers/auth.js";
import connectDB from "./utils/connectDb.js";
import cors from "cors";
import contactRouter from "./routers/contactData.js";
import StudentByIdRouter from "./routers/singleStudent.js";
import mailRouter from "./routers/mail.js";
import userRoutes from "./routers/user.js";
import teacherRoutes from "./routers/teacher.js";
import currentStudRouter from "./routers/currentStud.js";
import studentRouter from "./routers/student.js";
import uploadRouter from "./routers/upload.js";
import lessonRouter from "./routers/lesson.js";
import progressRouter from "./routers/progress.js";
import achievementRouter from "./routers/achievement.js";
import activityRouter from "./routers/activity.js";
import feeManagementRouter from "./routers/feeManagement.js";
import messageRouter from "./routers/message.js";
import notificationRouter from "./routers/notification.js";
import sessionRouter from "./routers/session.js";
import { initializeSocketIO } from "./utils/socket.js";
import { globalErrorHandler, notFoundHandler } from "./middlewares/errorHandler.js";
import {
  securityHeaders,
  authRateLimit,
  generalRateLimit,
  sanitizeMongo,
  sanitizeXSS,
  preventParamPollution
} from "./middlewares/security.js";
import swaggerUi from 'swagger-ui-express';
import specs from './utils/swagger.js';
import "dotenv/config";

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 4000;

// Initialize Socket.IO for video sessions
initializeSocketIO(httpServer);

// Security Middlewares
app.use(securityHeaders);           // Set security headers
app.use(sanitizeMongo);             // Sanitize data to prevent NoSQL injection
app.use(sanitizeXSS);               // Sanitize data to prevent XSS
app.use(preventParamPollution);     // Prevent parameter pollution

// CORS Configuration - Must specify origin when using credentials
const allowedOrigins = [
  'http://localhost:3000', 
  'http://localhost:3001', 
  'http://localhost:3002',
  'https://al-quran-institute-academy-frontend.vercel.app',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['set-cookie']
}));

// General middleware
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));        // Log HTTP requests using Winston

// Custom request logger middleware
app.use(requestLogger);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use(generalRateLimit);

connectDB();

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Al-Quran Institute Online API is running",
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Apply rate limiting to auth routes
app.use("/auth", authRateLimit, authRoutes);
app.use("/signup", authRateLimit, authRoutes);
app.use("/login", authRateLimit, authRoutes);

// Other routes
app.use("/user", userRoutes);
app.use("/teacher", teacherRoutes);
app.use("/contactForms", contactRouter);
app.use("/studentById", StudentByIdRouter);
app.use("/mail", mailRouter);
app.use("/getCurrentUser", currentStudRouter);
app.use("/students", studentRouter);
app.use("/upload", uploadRouter);
app.use("/lessons", lessonRouter);
app.use("/progress", progressRouter);
app.use("/achievements", achievementRouter);
app.use("/activities", activityRouter);
app.use("/fees", feeManagementRouter);
app.use("/messages", messageRouter);
app.use("/notifications", notificationRouter);
app.use("/sessions", sessionRouter);

// Catch 404 and forward to error handler
app.use(notFoundHandler);

// Error logger middleware (before error handler)
app.use(errorLogger);

// Error handler middleware
app.use(globalErrorHandler);

httpServer.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
  logger.info(`API documentation available at http://localhost:${PORT}/api-docs`);
  console.log(`WebSocket server ready for video sessions`);
});

export default app;
