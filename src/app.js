const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const profileRoutes = require("./routes/profileRoutes");
const { notFound, globalError } = require("./middleware/errorHandler");

const app = express();

// Security
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, please try again later." },
});
app.use("/api", limiter);

// Logging
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "GitHub Profile Analyzer API is running",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// API docs summary
app.get("/", (req, res) => {
  res.json({
    success: true,
    name: "GitHub Profile Analyzer API",
    version: "1.0.0",
    endpoints: {
      health: "GET /health",
      analyzeProfile: "POST /api/profiles/analyze/:username",
      listProfiles: "GET /api/profiles?page=1&limit=20&sort=analyzed_at&order=DESC",
      getProfile: "GET /api/profiles/:username",
      deleteProfile: "DELETE /api/profiles/:username",
    },
  });
});

// Routes
app.use("/api/profiles", profileRoutes);

// Error handling
app.use(notFound);
app.use(globalError);

module.exports = app;
