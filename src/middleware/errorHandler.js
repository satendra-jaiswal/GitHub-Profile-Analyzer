const { errorResponse } = require("../utils/response");

const notFound = (req, res) => {
  errorResponse(res, 404, `Route ${req.method} ${req.originalUrl} not found`);
};

const globalError = (err, req, res, next) => {
  console.error("Unhandled error:", err);
  errorResponse(res, err.statusCode || 500, err.message || "Internal server error");
};

module.exports = { notFound, globalError };
