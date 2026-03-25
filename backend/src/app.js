import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import mongoSanitize from "express-mongo-sanitize";

import authRoutes from "./routes/authRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import gradeRoutes from "./routes/gradeRoutes.js";
import interventionRoutes from "./routes/interventionRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import teacherRoutes from "./routes/teacherRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import parentRoutes from "./routes/parentRoutes.js";
import debugRoutes from "./routes/debugRoutes.js";
import meetingRoutes from "./routes/meetingRoutes.js";
import communicationsRoutes from "./routes/communicationsRoutes.js";

// Import middleware
import { errorHandler } from "./middleware/errorHandler.js";
import logger from "./utils/logger.js";

const app = express();

// Middleware setup
// Increase body size limits to support base64-encoded profile photos and larger payloads
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));
// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5174',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5174'
];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(helmet());
app.use(morgan("dev"));
app.use(compression());
app.use(mongoSanitize());

// Serve static files
app.use('/public', express.static('public'));

// Root welcome endpoint
app.get("/", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "🎓 Student Dropout Prevention System API",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    endpoints: {
      health: "/health",
      api: `/api/${process.env.API_VERSION || "v1"}`,
      students: `/api/${process.env.API_VERSION || "v1"}/students`,
      dashboard: `/api/${process.env.API_VERSION || "v1"}/dashboard`,
      interventions: `/api/${process.env.API_VERSION || "v1"}/interventions`,
      analytics: `/api/${process.env.API_VERSION || "v1"}/analytics`,
    },
    features: [
      "✅ Real-time student management",
      "✅ Risk assessment and monitoring", 
      "✅ Intervention tracking",
      "✅ Socket.io real-time updates",
      "✅ MongoDB integration",
      "✅ Comprehensive reporting"
    ],
    documentation: "Visit /api/v1/students to see student data",
    testPage: "Visit /public/test.html for real-time testing interface",
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Server is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// Test endpoint for CORS
app.get("/test", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "CORS test successful",
    timestamp: new Date().toISOString(),
    origin: req.headers.origin,
    userAgent: req.headers['user-agent'],
  });
});

// API VERSION WELCOME ROUTE - ADD THIS
const API_VERSION = process.env.API_VERSION || "v1";

app.get(`/api/${API_VERSION}`, (req, res) => {
  res.status(200).json({
    status: "success",
    message: `Welcome to Student Dropout Prevention System API ${API_VERSION}`,
    version: API_VERSION,
    timestamp: new Date().toISOString(),
    availableEndpoints: {
      auth: `/api/${API_VERSION}/auth`,
      students: `/api/${API_VERSION}/students`,
      attendance: `/api/${API_VERSION}/attendance`,
      grades: `/api/${API_VERSION}/grades`,
      interventions: `/api/${API_VERSION}/interventions`,
      analytics: `/api/${API_VERSION}/analytics`,
      reports: `/api/${API_VERSION}/reports`,
      notifications: `/api/${API_VERSION}/notifications`,
      users: `/api/${API_VERSION}/users`,
      dashboard: `/api/${API_VERSION}/dashboard`,
    },
    examples: {
      getAllStudents: `GET /api/${API_VERSION}/students`,
      getStudentById: `GET /api/${API_VERSION}/students/:id`,
      createStudent: `POST /api/${API_VERSION}/students`,
      getDashboard: `GET /api/${API_VERSION}/dashboard`,
    },
    documentation: "All endpoints are listed above with their HTTP methods",
  });
});

// API routes
app.use(`/api/${API_VERSION}/auth`, authRoutes);
app.use(`/api/${API_VERSION}/students`, studentRoutes);
app.use(`/api/${API_VERSION}/attendance`, attendanceRoutes);
app.use(`/api/${API_VERSION}/grades`, gradeRoutes);
app.use(`/api/${API_VERSION}/interventions`, interventionRoutes);
app.use(`/api/${API_VERSION}/analytics`, analyticsRoutes);
app.use(`/api/${API_VERSION}/reports`, reportRoutes);
app.use(`/api/${API_VERSION}/notifications`, notificationRoutes);
app.use(`/api/${API_VERSION}/users`, userRoutes);
app.use(`/api/${API_VERSION}/dashboard`, dashboardRoutes);
app.use(`/api/${API_VERSION}/teacher`, teacherRoutes);
app.use(`/api/${API_VERSION}/admin`, adminRoutes);
app.use(`/api/${API_VERSION}/parent`, parentRoutes);
app.use(`/api/${API_VERSION}/debug`, debugRoutes);
app.use(`/api/${API_VERSION}/meetings`, meetingRoutes);
app.use(`/api/${API_VERSION}/communications`, communicationsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: [
      `GET /api/${API_VERSION}`,
      `GET /api/${API_VERSION}/students`,
      `GET /api/${API_VERSION}/dashboard`,
      `GET /health`,
    ],
  });
});

// Error handler
app.use(errorHandler);

export default app;