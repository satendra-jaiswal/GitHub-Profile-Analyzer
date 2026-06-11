const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");
require("dotenv").config({ override: true });

const profileRoutes = require("./routes/profileRoutes");
const { notFound, globalError } = require("./middleware/errorHandler");

const app = express();

// Security
app.use(helmet());
app.set('trust proxy', 1);
app.use(cors());

// Rate limiting disabled as requested (no server-side request limits)

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

// Static files frontend
app.use(express.static(path.join(__dirname, "../public")));

// API docs summary
app.get("/api-info", (req, res) => {
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
