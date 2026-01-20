import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { createServer } from "node:http";
import { config } from "./config";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { connectRedis } from "./lib/redis";
import { errorHandler } from "./middleware/error";
import { initializeSocket } from "./config/socket";
import { startAlarmReminderScheduler, stopAlarmReminderScheduler } from "./services/alarmReminderScheduler";
import router from "./routes/index";

dotenv.config();

const STARTUP_MARKER = "notification-inline-2025-10-19T03:25Z";

const app = express();
const httpServer = createServer(app);

// Initialize Socket.io
initializeSocket(httpServer);

// Middleware
app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "unsafe-none" },
    contentSecurityPolicy: false,
  })
);

// Allow preflight for all routes
app.options("*", cors());

// Enable CORS
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow all origins
      callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Content-Range", "X-Content-Range"],
    maxAge: 86400,
  })
);

app.use(morgan(config.env === "development" ? "dev" : "combined"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    
    // Test basic operations
    const userCount = await prisma.user.count();
    const loginAttemptCount = await prisma.loginAttempt.count();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        userCount,
        loginAttemptCount
      },
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: false,
        error: error.message
      },
      environment: process.env.NODE_ENV || 'development'
    });
  }
});

// Main API router
app.use("/api", router);

// Global error handler
app.use(errorHandler);

// Graceful shutdown logic
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received. Shutting down gracefully...`);

  httpServer.close(() => {
    logger.info("HTTP server closed");
  });

  try {
    stopAlarmReminderScheduler();
    await prisma.$disconnect();
    logger.info("Database connection closed");
    process.exit(0);
  } catch (error) {
    logger.error("Error during shutdown:", error);
    process.exit(1);
  }
};

// Start the server
const startServer = async () => {
  try {
    logger.info("Backend startup marker", { marker: STARTUP_MARKER });
    await prisma.$connect();
    logger.info("Connected to database");

    await connectRedis();
    logger.info("Connected to Redis");

    startAlarmReminderScheduler();

    // 🔥 Important: Listen on 0.0.0.0 to accept external requests
    httpServer.listen(config.port, "0.0.0.0", () => {
      logger.info(`Server running on port ${config.port}`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

startServer();
