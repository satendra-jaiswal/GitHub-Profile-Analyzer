const {
  analyzeAndStore,
  getAllProfiles,
  getProfileByUsername,
  deleteProfile,
} = require("../services/profileService");
const { successResponse, errorResponse } = require("../utils/response");

/**
 * POST /api/profiles/analyze/:username
 * Fetch from GitHub, analyze, and store/update in DB
 */
const analyzeProfile = async (req, res) => {
  try {
    const { username } = req.params;
    const profile = await analyzeAndStore(username);
    return successResponse(res, 201, "Profile analyzed and stored successfully", profile);
  } catch (err) {
    const status = err.statusCode || 500;
    return errorResponse(res, status, err.message);
  }
};

/**
 * GET /api/profiles
 * List all analyzed profiles with pagination & sorting
 */
const listProfiles = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const sort = req.query.sort || "analyzed_at";
    const order = req.query.order || "DESC";

    const result = await getAllProfiles({ page, limit, sort, order });
    return successResponse(res, 200, "Profiles retrieved successfully", result.data, result.pagination);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

/**
 * GET /api/profiles/:username
 * Get detailed data for a single profile
 */
const getProfile = async (req, res) => {
  try {
    const { username } = req.params;
    const profile = await getProfileByUsername(username);
    if (!profile) {
      return errorResponse(res, 404, `Profile "${username}" not found. Analyze it first via POST /api/profiles/analyze/${username}`);
    }
    return successResponse(res, 200, "Profile retrieved successfully", profile);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

/**
 * DELETE /api/profiles/:username
 * Remove a profile and all its data from DB
 */
const removeProfile = async (req, res) => {
  try {
    const { username } = req.params;
    const deleted = await deleteProfile(username);
    if (!deleted) {
      return errorResponse(res, 404, `Profile "${username}" not found`);
    }
    return successResponse(res, 200, `Profile "${username}" deleted successfully`);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

module.exports = { analyzeProfile, listProfiles, getProfile, removeProfile };
